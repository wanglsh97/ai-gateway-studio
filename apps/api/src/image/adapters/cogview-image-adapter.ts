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

export type CogViewFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface CogViewImageAdapterOptions {
  apiKey: string
  baseUrl: string
  modelId: string
  fetch?: CogViewFetch
}

export class CogViewImageAdapter implements ImageAdapter {
  readonly id = 'cogview' as const
  readonly resolvedModel: string
  private readonly apiKey: string
  private readonly endpoint: string
  private readonly fetchImplementation: CogViewFetch

  constructor(options: CogViewImageAdapterOptions) {
    this.apiKey = requireNonEmpty(options.apiKey, 'CogView apiKey')
    this.resolvedModel = requireNonEmpty(options.modelId, 'CogView modelId')
    this.endpoint = `${normalizeBaseUrl(options.baseUrl)}/images/generations`
    this.fetchImplementation = options.fetch ?? fetch
  }

  async submit(request: ImageAdapterSubmitRequest): Promise<ImageAdapterSubmission> {
    if ((request.count ?? 1) !== 1) {
      throw new ImageAdapterError('CogView supports one image per request', {
        code: 'COGVIEW_COUNT_NOT_SUPPORTED',
        retryable: false,
        statusCode: 400,
      })
    }
    const response = await this.request(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.resolvedModel,
        prompt: request.prompt,
        ...(request.size === undefined ? {} : { size: request.size }),
        user_id: request.requestId,
      }),
      signal: request.signal,
    })
    const payload = await parseJson(response)
    if (!Array.isArray(payload.data) || payload.data.length === 0) {
      throw protocolError('CogView response is missing image data')
    }
    const results = payload.data.map((item) => {
      const result = record(item, 'CogView image result')
      const url = stringField(result.url)
      if (!url) throw protocolError('CogView image result is missing url')
      assertDownloadUrl(url)
      return { url }
    })
    const providerTaskId =
      stringField(payload.request_id) ??
      response.headers.get('x-request-id')?.trim() ??
      request.requestId
    return { providerTaskId, status: 'succeeded', results }
  }

  async getStatus(request: ImageAdapterStatusRequest): Promise<ImageAdapterStatus> {
    void request
    throw new ImageAdapterError('CogView synchronous tasks do not require provider polling', {
      code: 'COGVIEW_STATUS_NOT_SUPPORTED',
      retryable: false,
    })
  }

  async download(request: ImageAdapterDownloadRequest): Promise<ImageAdapterDownload> {
    assertDownloadUrl(request.url)
    const response = await this.request(
      request.url,
      {
        method: 'GET',
        redirect: 'error',
        signal: request.signal,
      },
      false,
    )
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    if (!contentType?.startsWith('image/')) throw protocolError('CogView download is not an image')
    return { body: new Uint8Array(await response.arrayBuffer()), contentType }
  }

  private async request(url: string, init: RequestInit, authenticated = true): Promise<Response> {
    let response: Response
    try {
      response = await this.fetchImplementation(url, {
        ...init,
        headers: {
          ...(authenticated ? { authorization: `Bearer ${this.apiKey}` } : {}),
          ...init.headers,
        },
      })
    } catch (error) {
      if (init.signal?.aborted) throw init.signal.reason ?? error
      throw new ImageAdapterError('CogView request failed', {
        code: 'COGVIEW_REQUEST_FAILED',
        retryable: true,
        cause: error,
      })
    }
    if (!response.ok) {
      throw new ImageAdapterError(`CogView returned HTTP ${response.status}`, {
        code: `COGVIEW_HTTP_${response.status}`,
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        statusCode: response.status,
      })
    }
    return response
  }
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return record(await response.json(), 'CogView response')
  } catch (error) {
    if (error instanceof ImageAdapterError) throw error
    throw new ImageAdapterError('CogView returned invalid JSON', {
      code: 'COGVIEW_PROTOCOL_ERROR',
      retryable: true,
      cause: error,
    })
  }
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(requireNonEmpty(value, 'CogView baseUrl'))
  if (url.protocol !== 'https:') throw new TypeError('CogView baseUrl must use HTTPS')
  return url.toString().replace(/\/$/, '')
}

function assertDownloadUrl(value: string): void {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw protocolError('CogView returned an invalid image URL')
  }
  const hostname = url.hostname.toLowerCase()
  const allowed = ['bigmodel.cn', 'chatglm.cn', 'zhipuai.cn'].some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  )
  if (url.protocol !== 'https:' || !allowed) {
    throw new ImageAdapterError('CogView image URL is not allowed', {
      code: 'COGVIEW_IMAGE_URL_NOT_ALLOWED',
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

function protocolError(message: string): ImageAdapterError {
  return new ImageAdapterError(message, {
    code: 'COGVIEW_PROTOCOL_ERROR',
    retryable: true,
  })
}
