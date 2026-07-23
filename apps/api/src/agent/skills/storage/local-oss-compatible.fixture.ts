import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import type { OssClientPort } from './aliyun-oss-skill-object-store'

interface LocalObject {
  bytes: Buffer
  headers: Record<string, string>
}

interface SignedPut {
  objectName: string
  headers: Record<string, string>
  expiresAt: number
}

export class LocalOssCompatibleFixture {
  private readonly objects = new Map<string, LocalObject>()
  private readonly signedPuts = new Map<string, SignedPut>()
  private readonly server: Server
  private baseUrl = ''

  constructor(
    private readonly bucket: string,
    private readonly acl: 'private' | 'public-read' = 'private',
  ) {
    this.server = createServer((request, response) => {
      void this.handle(request, response)
    })
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve))
    const address = this.server.address() as AddressInfo
    this.baseUrl = `http://127.0.0.1:${address.port}`
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => (error ? reject(error) : resolve())),
    )
  }

  publicObjectUrl(objectName: string): string {
    return `${this.baseUrl}/objects/${encodeURIComponent(objectName)}`
  }

  client(): OssClientPort {
    const adminHeaders = { 'x-local-oss-admin': 'true' }
    return {
      getBucketACL: async (bucket) => {
        const response = await fetch(
          `${this.baseUrl}/bucket-acl?bucket=${encodeURIComponent(bucket)}`,
          {
            headers: adminHeaders,
          },
        )
        return parseJson<{ acl: string }>(response)
      },
      head: async (name) => {
        const response = await fetch(this.publicObjectUrl(name), {
          method: 'HEAD',
          headers: adminHeaders,
        })
        assertOk(response)
        return {
          status: response.status,
          meta: metadata(response.headers),
          res: { status: response.status, headers: headersRecord(response.headers) },
        }
      },
      get: async (name) => {
        const response = await fetch(this.publicObjectUrl(name), { headers: adminHeaders })
        assertOk(response)
        return {
          content: Buffer.from(await response.arrayBuffer()),
          res: { status: response.status, headers: headersRecord(response.headers) },
        }
      },
      put: async (name, content, options) => {
        const response = await fetch(this.publicObjectUrl(name), {
          method: 'PUT',
          headers: {
            ...adminHeaders,
            ...options.headers,
            'content-type': options.mime,
            'x-oss-meta-kind': options.meta.kind,
            'x-oss-meta-sha256': options.meta.sha256,
            ...(options.meta.filename
              ? { 'x-oss-meta-filename': encodeURIComponent(options.meta.filename) }
              : {}),
          },
          body: Uint8Array.from(content),
        })
        assertOk(response)
        return {}
      },
      delete: async (name) => {
        const response = await fetch(this.publicObjectUrl(name), {
          method: 'DELETE',
          headers: adminHeaders,
        })
        assertOk(response)
        return {}
      },
      signatureUrlV4: async (method, expires, request, objectName, additionalHeaders) => {
        const response = await fetch(`${this.baseUrl}/sign`, {
          method: 'POST',
          headers: { ...adminHeaders, 'content-type': 'application/json' },
          body: JSON.stringify({
            method,
            expires,
            objectName,
            headers: request.headers,
            additionalHeaders,
          }),
        })
        const result = await parseJson<{ url: string }>(response)
        return result.url
      },
    }
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', this.baseUrl || 'http://127.0.0.1')
      if (url.pathname === '/bucket-acl') {
        if (!isAdmin(request)) return send(response, 403)
        const bucket = url.searchParams.get('bucket')
        return sendJson(response, bucket === this.bucket ? 200 : 404, { acl: this.acl })
      }
      if (url.pathname === '/sign') {
        if (!isAdmin(request)) return send(response, 403)
        const input = JSON.parse((await readBody(request)).toString()) as {
          method: string
          expires: number
          objectName: string
          headers: Record<string, string>
          additionalHeaders: string[]
        }
        if (
          input.method !== 'PUT' ||
          !Number.isInteger(input.expires) ||
          input.expires < 1 ||
          !input.additionalHeaders.every((header) => input.headers[header] !== undefined)
        ) {
          return send(response, 400)
        }
        const token = randomUUID()
        this.signedPuts.set(token, {
          objectName: input.objectName,
          headers: input.headers,
          expiresAt: Date.now() + input.expires * 1_000,
        })
        return sendJson(response, 200, {
          url: `${this.baseUrl}/signed/${token}/${encodeURIComponent(input.objectName)}`,
        })
      }
      if (url.pathname.startsWith('/signed/')) {
        if (request.method !== 'PUT') return send(response, 403)
        const [, , token, encodedName] = url.pathname.split('/')
        const signed = token ? this.signedPuts.get(token) : undefined
        const objectName = encodedName ? decodeURIComponent(encodedName) : ''
        if (
          !signed ||
          signed.expiresAt <= Date.now() ||
          signed.objectName !== objectName ||
          !headersMatch(request, signed.headers)
        ) {
          return send(response, 403)
        }
        this.store(objectName, await readBody(request), request.headers)
        return send(response, 200)
      }
      if (url.pathname.startsWith('/objects/')) {
        if (!isAdmin(request)) return send(response, 403)
        const objectName = decodeURIComponent(url.pathname.slice('/objects/'.length))
        if (request.method === 'PUT') {
          this.store(objectName, await readBody(request), request.headers)
          return send(response, 200)
        }
        if (request.method === 'DELETE') {
          this.objects.delete(objectName)
          return send(response, 204)
        }
        const object = this.objects.get(objectName)
        if (!object) return send(response, 404, { 'x-oss-error-code': 'NoSuchKey' })
        for (const [name, value] of Object.entries(object.headers)) response.setHeader(name, value)
        response.setHeader('content-length', String(object.bytes.byteLength))
        if (request.method === 'HEAD') return send(response, 200)
        if (request.method === 'GET') return send(response, 200, undefined, object.bytes)
      }
      send(response, 404)
    } catch {
      send(response, 500)
    }
  }

  private store(
    objectName: string,
    bytes: Buffer,
    incomingHeaders: IncomingMessage['headers'],
  ): void {
    this.objects.set(objectName, {
      bytes: Buffer.from(bytes),
      headers: {
        'content-type': header(incomingHeaders, 'content-type') ?? 'application/octet-stream',
        'last-modified': new Date().toUTCString(),
        'x-oss-meta-kind': header(incomingHeaders, 'x-oss-meta-kind') ?? '',
        'x-oss-meta-sha256': header(incomingHeaders, 'x-oss-meta-sha256') ?? '',
        ...(header(incomingHeaders, 'x-oss-meta-filename')
          ? { 'x-oss-meta-filename': header(incomingHeaders, 'x-oss-meta-filename')! }
          : {}),
      },
    })
  }
}

function isAdmin(request: IncomingMessage): boolean {
  return header(request.headers, 'x-local-oss-admin') === 'true'
}

function headersMatch(request: IncomingMessage, expected: Record<string, string>): boolean {
  return Object.entries(expected).every(
    ([name, value]) => header(request.headers, name)?.trim() === value,
  )
}

function metadata(headers: Headers): Record<string, string> {
  return {
    kind: headers.get('x-oss-meta-kind') ?? '',
    sha256: headers.get('x-oss-meta-sha256') ?? '',
  }
}

function headersRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries())
}

function header(headers: IncomingMessage['headers'], name: string): string | undefined {
  const value = headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function parseJson<T>(response: Response): Promise<T> {
  assertOk(response)
  return (await response.json()) as T
}

function assertOk(response: Response): void {
  if (response.ok) return
  throw Object.assign(new Error(`Local OSS HTTP ${response.status}`), {
    status: response.status,
    code: response.headers.get('x-oss-error-code') ?? undefined,
  })
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  send(response, status, { 'content-type': 'application/json' }, Buffer.from(JSON.stringify(body)))
}

function send(
  response: ServerResponse,
  status: number,
  headers?: Record<string, string>,
  body?: Buffer,
): void {
  if (response.writableEnded) return
  response.writeHead(status, headers)
  response.end(body)
}
