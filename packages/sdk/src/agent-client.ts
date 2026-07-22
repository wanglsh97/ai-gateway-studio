import { decodeAgentEvent } from './agent-events.js'
import type { AgentSkillMarketItem, UpdateAgentSkillRequest } from './agent-skill-types.js'
import type {
  AgentRunSummary,
  AgentStreamEvent,
  AgentThread,
  AgentThreadListPage,
  AgentThreadSummary,
  CreateAgentRunRequest,
  CreateAgentThreadRequest,
  UpdateAgentThreadRequest,
} from './agent-types.js'
import { AIGatewayAuthenticationError, AIGatewayError, AIGatewayProtocolError } from './errors.js'
import { readSseData } from './sse.js'
import type { GatewayError } from './types.js'

export interface RequestOptions {
  signal?: AbortSignal
}

export interface AgentEventSubscribeOptions extends RequestOptions {
  /** 从该 sequence 之后开始接收事件（用于断线补读）。默认从头开始。 */
  after?: number
}

export interface AgentThreadListOptions extends RequestOptions {
  page?: number
  pageSize?: number
}

export interface AgentClient {
  skills: {
    list(options?: RequestOptions): Promise<AgentSkillMarketItem[]>
    install(skillId: string, options?: RequestOptions): Promise<AgentSkillMarketItem>
    update(
      skillId: string,
      input: UpdateAgentSkillRequest,
      options?: RequestOptions,
    ): Promise<AgentSkillMarketItem>
    uninstall(skillId: string, options?: RequestOptions): Promise<void>
  }
  threads: {
    create(input: CreateAgentThreadRequest, options?: RequestOptions): Promise<AgentThreadSummary>
    list(options?: AgentThreadListOptions): Promise<AgentThreadListPage>
    get(threadId: string, options?: RequestOptions): Promise<AgentThread>
    rename(
      threadId: string,
      input: UpdateAgentThreadRequest,
      options?: RequestOptions,
    ): Promise<AgentThreadSummary>
    delete(threadId: string, options?: RequestOptions): Promise<void>
  }
  runs: {
    create(
      threadId: string,
      input: CreateAgentRunRequest,
      options?: RequestOptions,
    ): Promise<AgentRunSummary>
    cancel(runId: string, options?: RequestOptions): Promise<AgentRunSummary>
    /**
     * 订阅 run 事件流。按 sequence 递增产出事件；断线后可用最后 sequence 作为 `after` 重连补读。
     */
    subscribe(runId: string, options?: AgentEventSubscribeOptions): AsyncIterable<AgentStreamEvent>
  }
}

export function createAgentClient(
  fetchImplementation: typeof globalThis.fetch,
  baseUrl: string,
): AgentClient {
  return {
    skills: {
      list: async (options) => {
        const value = await requestJson<unknown>(
          fetchImplementation,
          'GET',
          `${baseUrl}/api/v1/agent/skills`,
          undefined,
          options,
        )
        if (!Array.isArray(value))
          throw new AIGatewayProtocolError('unknown', 'Agent Skill catalog is not an array')
        return value.map(decodeSkillMarketItem)
      },
      install: async (skillId, options) =>
        decodeSkillMarketItem(
          await requestJson(
            fetchImplementation,
            'PUT',
            `${baseUrl}/api/v1/agent/skills/${encodeURIComponent(skillId)}/install`,
            undefined,
            options,
          ),
        ),
      update: async (skillId, input, options) =>
        decodeSkillMarketItem(
          await requestJson(
            fetchImplementation,
            'PATCH',
            `${baseUrl}/api/v1/agent/skills/${encodeURIComponent(skillId)}`,
            input,
            options,
          ),
        ),
      uninstall: (skillId, options) =>
        requestVoid(
          fetchImplementation,
          'DELETE',
          `${baseUrl}/api/v1/agent/skills/${encodeURIComponent(skillId)}/install`,
          options,
        ),
    },
    threads: {
      create: (input, options) =>
        requestJson(fetchImplementation, 'POST', `${baseUrl}/api/v1/agent/threads`, input, options),
      list: (options) => {
        const params = new URLSearchParams()
        if (options?.page !== undefined) params.set('page', String(options.page))
        if (options?.pageSize !== undefined) params.set('pageSize', String(options.pageSize))
        const query = params.toString()
        return requestJson(
          fetchImplementation,
          'GET',
          `${baseUrl}/api/v1/agent/threads${query ? `?${query}` : ''}`,
          undefined,
          options,
        )
      },
      get: (threadId, options) =>
        requestJson(
          fetchImplementation,
          'GET',
          `${baseUrl}/api/v1/agent/threads/${encodeURIComponent(threadId)}`,
          undefined,
          options,
        ),
      rename: (threadId, input, options) =>
        requestJson(
          fetchImplementation,
          'PATCH',
          `${baseUrl}/api/v1/agent/threads/${encodeURIComponent(threadId)}`,
          input,
          options,
        ),
      delete: (threadId, options) =>
        requestVoid(
          fetchImplementation,
          'DELETE',
          `${baseUrl}/api/v1/agent/threads/${encodeURIComponent(threadId)}`,
          options,
        ),
    },
    runs: {
      create: (threadId, input, options) =>
        requestJson(
          fetchImplementation,
          'POST',
          `${baseUrl}/api/v1/agent/threads/${encodeURIComponent(threadId)}/runs`,
          input,
          options,
        ),
      cancel: (runId, options) =>
        requestJson(
          fetchImplementation,
          'POST',
          `${baseUrl}/api/v1/agent/runs/${encodeURIComponent(runId)}/cancel`,
          undefined,
          options,
        ),
      subscribe: (runId, options) =>
        subscribeRunEvents(fetchImplementation, baseUrl, runId, options),
    },
  }
}

function decodeSkillMarketItem(value: unknown): AgentSkillMarketItem {
  const item = asRecord(value)
  const allowedTools = item?.allowedTools
  if (
    !item ||
    !stringValue(item.id) ||
    !stringValue(item.name) ||
    !stringValue(item.version) ||
    typeof item.description !== 'string' ||
    !stringValue(item.category) ||
    !Array.isArray(allowedTools) ||
    !allowedTools.every((tool) => typeof tool === 'string') ||
    typeof item.installed !== 'boolean' ||
    typeof item.enabled !== 'boolean'
  ) {
    throw new AIGatewayProtocolError('unknown', 'Agent Skill response is malformed')
  }
  return {
    id: item.id as string,
    name: item.name as string,
    version: item.version as string,
    description: item.description,
    category: item.category as string,
    allowedTools,
    installed: item.installed,
    enabled: item.enabled,
  }
}

async function requestJson<T>(
  fetchImplementation: typeof globalThis.fetch,
  method: string,
  url: string,
  body: unknown,
  options: RequestOptions | undefined,
): Promise<T> {
  const response = await fetchImplementation(url, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
  })
  const requestId = response.headers.get('x-request-id')
  if (!response.ok) throw await responseError(response, requestId)
  try {
    return (await response.json()) as T
  } catch (error) {
    throw new AIGatewayProtocolError(
      requestId ?? 'unknown',
      'Agent response is not valid JSON',
      error,
    )
  }
}

async function requestVoid(
  fetchImplementation: typeof globalThis.fetch,
  method: string,
  url: string,
  options: RequestOptions | undefined,
): Promise<void> {
  const response = await fetchImplementation(url, {
    method,
    headers: { accept: 'application/json' },
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
  })
  if (!response.ok) throw await responseError(response, response.headers.get('x-request-id'))
}

async function* subscribeRunEvents(
  fetchImplementation: typeof globalThis.fetch,
  baseUrl: string,
  runId: string,
  options: AgentEventSubscribeOptions | undefined,
): AsyncGenerator<AgentStreamEvent, void, void> {
  const after = options?.after ?? -1
  const url = `${baseUrl}/api/v1/agent/runs/${encodeURIComponent(runId)}/events?after=${after}`
  const response = await fetchImplementation(url, {
    method: 'GET',
    headers: { accept: 'text/event-stream' },
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
  })
  const requestId = response.headers.get('x-request-id')
  if (!response.ok) throw await responseError(response, requestId)
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
    throw new AIGatewayProtocolError(
      requestId ?? 'unknown',
      'Agent events response is not text/event-stream',
    )
  }
  if (!response.body) {
    throw new AIGatewayProtocolError(requestId ?? 'unknown', 'Agent events response has no body')
  }

  let previousSequence = after
  let done = false
  for await (const data of readSseData(response.body)) {
    if (done) throw new AIGatewayProtocolError(runId, 'Agent SSE emitted data after [DONE]')
    if (data === '[DONE]') {
      done = true
      continue
    }
    const event = decodeAgentEvent(parseJson(data, runId), runId)
    if (event.sequence <= previousSequence) {
      throw new AIGatewayProtocolError(runId, 'Agent SSE emitted a non-increasing sequence')
    }
    previousSequence = event.sequence
    yield event
  }
}

function parseJson(data: string, runId: string): unknown {
  try {
    return JSON.parse(data)
  } catch (error) {
    throw new AIGatewayProtocolError(runId, 'Agent SSE data is not valid JSON', error)
  }
}

async function responseError(
  response: Response,
  headerRequestId: string | null,
): Promise<AIGatewayError> {
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
    message: stringValue(record?.message) ?? `Agent request failed with HTTP ${response.status}`,
    retryable:
      booleanValue(record?.retryable) ?? (response.status === 429 || response.status >= 500),
    ...(details === undefined ? {} : { details }),
  }
  return response.status === 401
    ? new AIGatewayAuthenticationError(error)
    : new AIGatewayError(error, { status: response.status })
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
