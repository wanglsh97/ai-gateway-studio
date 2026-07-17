import type {
  ImageAdapter,
  ImageAdapterDownload,
  ImageAdapterDownloadRequest,
  ImageAdapterStatus,
  ImageAdapterStatusRequest,
  ImageAdapterSubmission,
  ImageAdapterSubmitRequest,
} from './image-adapter'
import { ImageAdapterError } from './image-adapter'

export type WanxiangFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface WanxiangImageAdapterOptions {
  apiKey: string
  baseUrl: string
  modelId: string
  fetch?: WanxiangFetch
}

export class WanxiangImageAdapter implements ImageAdapter {
  readonly id = 'wanxiang' as const
  readonly resolvedModel: string
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly fetchImplementation: WanxiangFetch

  constructor(options: WanxiangImageAdapterOptions) {
    this.apiKey = requireNonEmpty(options.apiKey, 'Wanxiang apiKey')
    this.resolvedModel = requireNonEmpty(options.modelId, 'Wanxiang modelId')
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.fetchImplementation = options.fetch ?? fetch
  }

  async submit(request: ImageAdapterSubmitRequest): Promise<ImageAdapterSubmission> {
    const response = await this.requestJson(
      `${this.baseUrl}/services/aigc/text2image/image-synthesis`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-dashscope-async': 'enable' },
        body: JSON.stringify({
          model: this.resolvedModel,
          input: { prompt: request.prompt },
          parameters: {
            ...(request.size === undefined ? {} : { size: request.size.replace('x', '*') }),
            ...(request.count === undefined ? {} : { n: request.count }),
          },
        }),
        signal: request.signal,
      },
      'WANXIANG_SUBMIT',
    )
    const output = record(response, 'Wanxiang submission').output
    const taskId = stringField(record(output, 'Wanxiang submission output').task_id)
    if (!taskId) throw protocolError('Wanxiang submission is missing task_id')
    return { providerTaskId: taskId, status: 'pending' }
  }

  async getStatus(request: ImageAdapterStatusRequest): Promise<ImageAdapterStatus> {
    const response = await this.requestJson(
      `${this.baseUrl}/tasks/${encodeURIComponent(request.providerTaskId)}`,
      { method: 'GET', signal: request.signal },
      'WANXIANG_STATUS',
    )
    const output = record(record(response, 'Wanxiang status').output, 'Wanxiang status output')
    const status = stringField(output.task_status)?.toUpperCase()
    if (status === 'PENDING') return { status: 'pending' }
    if (status === 'RUNNING') return { status: 'running' }
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      return {
        status: 'failed',
        errorCode: stringField(output.code) ?? `WANXIANG_${status}`,
        errorMessage: stringField(output.message) ?? 'Wanxiang image task failed',
      }
    }
    if (status !== 'SUCCEEDED') throw protocolError('Wanxiang returned an unknown task status')
    if (!Array.isArray(output.results) || output.results.length === 0) {
      throw protocolError('Wanxiang succeeded without image results')
    }
    return {
      status: 'succeeded',
      results: output.results.map((item) => {
        const result = record(item, 'Wanxiang image result')
        const url = stringField(result.url)
        if (!url) throw protocolError('Wanxiang image result is missing url')
        assertDownloadUrl(url)
        return { url }
      }),
    }
  }

  async download(request: ImageAdapterDownloadRequest): Promise<ImageAdapterDownload> {
    assertDownloadUrl(request.url)
    let response: Response
    try {
      response = await this.fetchImplementation(request.url, {
        method: 'GET',
        redirect: 'error',
        signal: request.signal,
      })
    } catch (error) {
      if (request.signal.aborted) throw request.signal.reason ?? error
      throw new ImageAdapterError('Wanxiang image download failed', {
        code: 'WANXIANG_DOWNLOAD_FAILED',
        retryable: true,
        cause: error,
      })
    }
    if (!response.ok) throw httpError('WANXIANG_DOWNLOAD', response.status)
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    if (!contentType?.startsWith('image/')) throw protocolError('Wanxiang download is not an image')
    return { body: new Uint8Array(await response.arrayBuffer()), contentType }
  }

  private async requestJson(
    url: string,
    init: RequestInit,
    codePrefix: string,
  ): Promise<Record<string, unknown>> {
    let response: Response
    try {
      response = await this.fetchImplementation(url, {
        ...init,
        headers: { authorization: `Bearer ${this.apiKey}`, ...init.headers },
      })
    } catch (error) {
      if (init.signal?.aborted) throw init.signal.reason ?? error
      throw new ImageAdapterError('Wanxiang request failed', {
        code: `${codePrefix}_FAILED`,
        retryable: true,
        cause: error,
      })
    }
    if (!response.ok) throw httpError(codePrefix, response.status)
    try {
      return record(await response.json(), 'Wanxiang response')
    } catch (error) {
      throw new ImageAdapterError('Wanxiang returned invalid JSON', {
        code: 'WANXIANG_PROTOCOL_ERROR',
        retryable: true,
        cause: error,
      })
    }
  }
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(requireNonEmpty(value, 'Wanxiang baseUrl'))
  if (url.protocol !== 'https:') throw new TypeError('Wanxiang baseUrl must use HTTPS')
  return url.toString().replace(/\/$/, '')
}

function assertDownloadUrl(value: string): void {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw protocolError('Wanxiang returned an invalid image URL')
  }
  const hostname = url.hostname.toLowerCase()
  if (
    url.protocol !== 'https:' ||
    !(hostname.endsWith('.aliyuncs.com') || hostname.endsWith('.alicdn.com'))
  ) {
    throw new ImageAdapterError('Wanxiang image URL is not allowed', {
      code: 'WANXIANG_IMAGE_URL_NOT_ALLOWED',
      retryable: false,
    })
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw protocolError(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function requireNonEmpty(value: string, label: string): string {
  if (!value.trim()) throw new TypeError(`${label} must not be empty`)
  return value
}

function httpError(prefix: string, status: number): ImageAdapterError {
  return new ImageAdapterError(`Wanxiang returned HTTP ${status}`, {
    code: `${prefix}_HTTP_${status}`,
    retryable: status === 408 || status === 429 || status >= 500,
    statusCode: status,
  })
}

function protocolError(message: string): ImageAdapterError {
  return new ImageAdapterError(message, {
    code: 'WANXIANG_PROTOCOL_ERROR',
    retryable: true,
  })
}
