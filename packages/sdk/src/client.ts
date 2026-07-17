import type {
  ChatEvent,
  ChatRequest,
  GatewayError,
  ImageRequest,
  ImageTask,
  ModelSummary,
  OptimizePromptRequest,
  OptimizePromptResult,
} from './types.js'
import {
  AIGatewayError,
  AIGatewayFeatureUnavailableError,
  AIGatewayProtocolError,
} from './errors.js'
import { readSseData } from './sse.js'

export interface RequestOptions {
  signal?: AbortSignal
}

export interface ImageWaitOptions extends RequestOptions {
  intervalMs?: number
  timeoutMs?: number
}

export interface CreateAIGatewayClientOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

export interface AIGatewayClient {
  chat: {
    stream(input: ChatRequest, options?: RequestOptions): AsyncIterable<ChatEvent>
  }
  images: {
    create(input: ImageRequest, options?: RequestOptions): Promise<ImageTask>
    get(taskId: string, options?: RequestOptions): Promise<ImageTask>
    wait(taskId: string, options?: ImageWaitOptions): Promise<ImageTask>
    downloadUrl(taskId: string, index: number): string
  }
  prompts: {
    optimize(input: OptimizePromptRequest, options?: RequestOptions): Promise<OptimizePromptResult>
  }
  models: {
    list(options?: RequestOptions): Promise<ModelSummary[]>
  }
}

export function createAIGatewayClient(options: CreateAIGatewayClientOptions = {}): AIGatewayClient {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  if (!fetchImplementation) throw new TypeError('A Fetch API implementation is required')
  const baseUrl = (options.baseUrl ?? '').replace(/\/$/, '')

  return {
    chat: {
      stream: (input, requestOptions) =>
        streamChat(fetchImplementation, baseUrl, input, requestOptions),
    },
    images: {
      create: async () => unavailable('images.create'),
      get: async () => unavailable('images.get'),
      wait: async () => unavailable('images.wait'),
      downloadUrl: () => unavailable('images.downloadUrl'),
    },
    prompts: {
      optimize: async () => unavailable('prompts.optimize'),
    },
    models: {
      list: (requestOptions) => listModels(fetchImplementation, baseUrl, requestOptions),
    },
  }
}

async function listModels(
  fetchImplementation: typeof globalThis.fetch,
  baseUrl: string,
  options: RequestOptions | undefined,
): Promise<ModelSummary[]> {
  const response = await fetchImplementation(`${baseUrl}/api/v1/models`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
  })
  const requestId = response.headers.get('x-request-id')

  if (!response.ok) throw await responseError(response, requestId)

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw new AIGatewayProtocolError(
      requestId ?? 'unknown',
      'Models response is not valid JSON',
      error,
    )
  }

  if (!Array.isArray(body)) {
    throw new AIGatewayProtocolError(requestId ?? 'unknown', 'Models response must be an array')
  }

  return body.map((value) => parseModelSummary(value, requestId ?? 'unknown'))
}

function parseModelSummary(value: unknown, requestId: string): ModelSummary {
  const model = asRecord(value)
  const alias = stringValue(model?.alias)
  const displayName = stringValue(model?.displayName)
  const capabilities = model?.capabilities
  const enabled = booleanValue(model?.enabled)
  const configured = booleanValue(model?.configured)
  const health = model?.health

  if (
    !model ||
    !alias ||
    !['qwen', 'glm', 'deepseek', 'kimi', 'wanxiang', 'cogview'].includes(alias) ||
    !displayName ||
    !Array.isArray(capabilities) ||
    !capabilities.every((item) => ['chat', 'image', 'prompt'].includes(String(item))) ||
    enabled === undefined ||
    configured === undefined ||
    !['unknown', 'healthy', 'unhealthy'].includes(String(health))
  ) {
    throw new AIGatewayProtocolError(requestId, 'Models response contains an invalid model summary')
  }

  return value as ModelSummary
}

async function* streamChat(
  fetchImplementation: typeof globalThis.fetch,
  baseUrl: string,
  input: ChatRequest,
  options: RequestOptions | undefined,
): AsyncGenerator<ChatEvent, void, void> {
  const response = await fetchImplementation(`${baseUrl}/api/v1/chat/completions`, {
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
  })
  const headerRequestId = response.headers.get('x-request-id')

  if (!response.ok) throw await responseError(response, headerRequestId)
  if (!headerRequestId) {
    throw new AIGatewayProtocolError('unknown', 'Chat response is missing x-request-id')
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
    throw new AIGatewayProtocolError(headerRequestId, 'Chat response is not text/event-stream')
  }
  if (!response.body) {
    throw new AIGatewayProtocolError(headerRequestId, 'Chat response has no readable body')
  }

  yield { type: 'start', requestId: headerRequestId, model: input.model }

  let doneCount = 0
  let usageCount = 0

  for await (const data of readSseData(response.body)) {
    if (doneCount > 0) {
      throw new AIGatewayProtocolError(headerRequestId, 'SSE data was emitted after [DONE]')
    }
    if (data === '[DONE]') {
      doneCount += 1
      continue
    }

    const payload = parseJsonRecord(data, headerRequestId)
    assertRequestId(payload, headerRequestId)

    if (payload.object === 'chat.completion.chunk') {
      for (const content of parseDeltaContents(payload, headerRequestId)) {
        yield { type: 'delta', requestId: headerRequestId, content }
      }
      continue
    }

    if (payload.object === 'chat.completion.usage') {
      usageCount += 1
      if (usageCount > 1) {
        throw new AIGatewayProtocolError(headerRequestId, 'SSE emitted usage more than once')
      }
      yield {
        type: 'usage',
        requestId: headerRequestId,
        usage: parseUsage(payload, headerRequestId),
      }
      continue
    }

    if (payload.object === 'chat.completion.error') {
      yield {
        type: 'error',
        requestId: headerRequestId,
        error: parseStreamError(payload, headerRequestId),
      }
      return
    }

    throw new AIGatewayProtocolError(headerRequestId, 'SSE emitted an unknown payload object')
  }

  if (doneCount !== 1) {
    throw new AIGatewayProtocolError(headerRequestId, 'SSE must end with exactly one [DONE]')
  }
  if (usageCount !== 1) {
    throw new AIGatewayProtocolError(headerRequestId, 'SSE must emit exactly one usage payload')
  }

  yield { type: 'done', requestId: headerRequestId }
}

async function responseError(response: Response, headerRequestId: string | null) {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }

  const record = asRecord(body)
  const requestId = stringValue(record?.requestId) ?? headerRequestId ?? 'unknown'
  const details = asRecord(record?.details)
  const error: GatewayError = {
    requestId,
    code: stringValue(record?.code) ?? `HTTP_${response.status}`,
    message: stringValue(record?.message) ?? `Gateway request failed with HTTP ${response.status}`,
    retryable:
      booleanValue(record?.retryable) ?? (response.status === 429 || response.status >= 500),
    ...(details === undefined ? {} : { details }),
  }
  return new AIGatewayError(error, { status: response.status })
}

function parseJsonRecord(data: string, requestId: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(data)
    const record = asRecord(value)
    if (record) return record
  } catch (error) {
    throw new AIGatewayProtocolError(requestId, 'SSE data is not valid JSON', error)
  }
  throw new AIGatewayProtocolError(requestId, 'SSE JSON payload must be an object')
}

function assertRequestId(payload: Record<string, unknown>, expected: string): void {
  if (payload.request_id !== expected) {
    throw new AIGatewayProtocolError(expected, 'SSE request_id does not match x-request-id')
  }
}

function parseDeltaContents(payload: Record<string, unknown>, requestId: string): string[] {
  if (!Array.isArray(payload.choices)) {
    throw new AIGatewayProtocolError(requestId, 'Chat chunk choices must be an array')
  }

  const contents: string[] = []
  for (const value of payload.choices) {
    const choice = asRecord(value)
    const delta = asRecord(choice?.delta)
    if (!choice || !delta) {
      throw new AIGatewayProtocolError(requestId, 'Chat chunk choice is invalid')
    }
    if (delta.content !== undefined && typeof delta.content !== 'string') {
      throw new AIGatewayProtocolError(requestId, 'Chat delta content must be a string')
    }
    if (typeof delta.content === 'string' && delta.content.length > 0) contents.push(delta.content)
  }
  return contents
}

function parseUsage(payload: Record<string, unknown>, requestId: string) {
  const usage = asRecord(payload.usage)
  const extension = asRecord(usage?.aigateway)
  if (!usage || !extension) {
    throw new AIGatewayProtocolError(requestId, 'Chat usage payload is invalid')
  }

  return {
    inputTokens: nullableNumber(usage.prompt_tokens, requestId),
    outputTokens: nullableNumber(usage.completion_tokens, requestId),
    totalTokens: nullableNumber(usage.total_tokens, requestId),
    estimatedCostCny: nullableString(extension.estimated_cost_cny, requestId),
    usageUnknown: requiredBoolean(extension.usage_unknown, requestId),
  }
}

function parseStreamError(payload: Record<string, unknown>, requestId: string): GatewayError {
  const error = asRecord(payload.error)
  if (!error) throw new AIGatewayProtocolError(requestId, 'Chat error payload is invalid')
  const code = stringValue(error.code)
  const message = stringValue(error.message)
  const retryable = booleanValue(error.retryable)
  if (!code || !message || retryable === undefined) {
    throw new AIGatewayProtocolError(requestId, 'Chat error fields are invalid')
  }
  const details = asRecord(error.details)
  return {
    requestId,
    code,
    message,
    retryable,
    ...(details === undefined ? {} : { details }),
  }
}

function nullableNumber(value: unknown, requestId: string): number | null {
  if (value === null || typeof value === 'number') return value
  throw new AIGatewayProtocolError(requestId, 'Usage token value must be a number or null')
}

function nullableString(value: unknown, requestId: string): string | null {
  if (value === null || typeof value === 'string') return value
  throw new AIGatewayProtocolError(requestId, 'Usage cost value must be a string or null')
}

function requiredBoolean(value: unknown, requestId: string): boolean {
  if (typeof value === 'boolean') return value
  throw new AIGatewayProtocolError(requestId, 'Usage unknown flag must be a boolean')
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function unavailable(feature: string): never {
  throw new AIGatewayFeatureUnavailableError(feature)
}
