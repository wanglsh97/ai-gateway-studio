import type { ChatFinishReason } from '@aigateway/sdk'

import {
  OpenAICompatibleHttpError,
  OpenAICompatibleProtocolError,
  OpenAICompatibleTimeoutError,
} from '../transports/openai-compatible-chat.transport'
import type { OpenAICompatibleChatTransport } from '../transports/openai-compatible-chat.transport'
import type {
  ChatAdapter,
  ChatAdapterEvent,
  ChatAdapterRequest,
  ChatAdapterToolCall,
  ChatAdapterUsage,
} from './chat-adapter'
import { ChatAdapterError } from './chat-adapter'
import { toOpenAICompatibleMessages } from './openai-compatible-message'

export interface QwenChatAdapterOptions {
  apiKey: string
  baseUrl: string
  modelId: string
}

const UNKNOWN_USAGE: ChatAdapterUsage = Object.freeze({
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  usageUnknown: true,
})

export class QwenChatAdapter implements ChatAdapter {
  readonly id = 'qwen' as const
  readonly resolvedModel: string
  private readonly apiKey: string
  private readonly endpoint: string

  constructor(
    private readonly transport: OpenAICompatibleChatTransport,
    options: QwenChatAdapterOptions,
  ) {
    this.apiKey = requireNonEmpty(options.apiKey, 'Qwen apiKey')
    this.resolvedModel = requireNonEmpty(options.modelId, 'Qwen modelId')
    this.endpoint = chatCompletionsEndpoint(options.baseUrl)
  }

  async *stream(request: ChatAdapterRequest): AsyncIterable<ChatAdapterEvent> {
    let finishReason: ChatFinishReason | undefined
    let usage: ChatAdapterUsage | undefined
    let providerRequestId: string | undefined
    const pendingToolCalls = new Map<number, PendingQwenToolCall>()
    let toolCallsEmitted = false

    try {
      for await (const event of this.transport.stream({
        url: this.endpoint,
        headers: { authorization: `Bearer ${this.apiKey}` },
        body: this.requestBody(request),
        signal: request.signal,
      })) {
        if (event.providerRequestId !== undefined) providerRequestId = event.providerRequestId

        if (event.type === 'done') {
          if (finishReason === undefined) {
            throw this.protocolError('Qwen stream ended without a finish reason')
          }
          if (finishReason === 'tool_calls' && !toolCallsEmitted) {
            throw this.protocolError('Qwen finished with tool_calls but emitted no valid tool call')
          }
          yield {
            type: 'usage',
            usage: usage ?? UNKNOWN_USAGE,
            ...(providerRequestId === undefined ? {} : { providerRequestId }),
          }
          yield {
            type: 'finish',
            finishReason,
            ...(providerRequestId === undefined ? {} : { providerRequestId }),
          }
          return
        }

        const chunk = this.parseChunk(event.data)
        for (const delta of chunk.toolCallDeltas ?? []) {
          mergeToolCallDelta(pendingToolCalls, delta, this.protocolError.bind(this))
        }
        if (chunk.content !== undefined) {
          yield {
            type: 'delta',
            content: chunk.content,
            ...(providerRequestId === undefined ? {} : { providerRequestId }),
          }
        }
        if (chunk.usage !== undefined) {
          if (usage !== undefined) throw this.protocolError('Qwen emitted usage more than once')
          usage = chunk.usage
        }
        if (chunk.finishReason !== undefined) {
          if (finishReason !== undefined) {
            throw this.protocolError('Qwen emitted a finish reason more than once')
          }
          if (chunk.finishReason === 'tool_calls') {
            const toolCalls = finalizeToolCalls(pendingToolCalls, this.protocolError.bind(this))
            for (const toolCall of toolCalls) {
              yield {
                type: 'tool-call',
                toolCall,
                ...(providerRequestId === undefined ? {} : { providerRequestId }),
              }
            }
            toolCallsEmitted = true
          } else if (pendingToolCalls.size > 0) {
            throw this.protocolError(
              `Qwen emitted tool-call fragments but finished with ${chunk.finishReason}`,
            )
          }
          finishReason = chunk.finishReason
        }
      }
    } catch (error) {
      if (request.signal.aborted) throw abortReason(request.signal)
      throw this.mapError(error)
    }
  }

  private requestBody(request: ChatAdapterRequest): Record<string, unknown> {
    return {
      model: request.resolvedModel,
      messages: toOpenAICompatibleMessages(request.messages),
      stream: true,
      stream_options: { include_usage: true },
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.topP === undefined ? {} : { top_p: request.topP }),
      ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool) => ({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
            tool_choice: request.toolChoice ?? 'auto',
          }
        : {}),
    }
  }

  private parseChunk(data: unknown): {
    content?: string
    finishReason?: ChatFinishReason
    toolCallDeltas?: QwenToolCallDelta[]
    usage?: ChatAdapterUsage
  } {
    const chunk = record(data, 'Qwen chunk')
    if (chunk.error !== undefined) throw this.streamError(chunk.error)

    const parsed: {
      content?: string
      finishReason?: ChatFinishReason
      toolCallDeltas?: QwenToolCallDelta[]
      usage?: ChatAdapterUsage
    } = {}

    if (chunk.usage !== undefined && chunk.usage !== null) {
      parsed.usage = this.parseUsage(chunk.usage)
    }

    if (chunk.choices !== undefined) {
      if (!Array.isArray(chunk.choices)) throw this.protocolError('Qwen choices must be an array')
      const choice = chunk.choices[0]
      if (choice !== undefined) {
        const parsedChoice = record(choice, 'Qwen choice')
        if (parsedChoice.delta !== undefined && parsedChoice.delta !== null) {
          const delta = record(parsedChoice.delta, 'Qwen delta')
          if (delta.content !== undefined && delta.content !== null) {
            if (typeof delta.content !== 'string') {
              throw this.protocolError('Qwen delta content must be a string or null')
            }
            if (delta.content.length > 0) parsed.content = delta.content
          }
          if (delta.tool_calls !== undefined && delta.tool_calls !== null) {
            parsed.toolCallDeltas = this.parseToolCallDeltas(delta.tool_calls)
          }
        }
        if (parsedChoice.finish_reason !== undefined && parsedChoice.finish_reason !== null) {
          if (typeof parsedChoice.finish_reason !== 'string') {
            throw this.protocolError('Qwen finish_reason must be a string or null')
          }
          parsed.finishReason = mapFinishReason(parsedChoice.finish_reason)
        }
      }
    }

    if (chunk.choices === undefined && chunk.usage === undefined) {
      throw this.protocolError('Qwen chunk contains neither choices nor usage')
    }
    return parsed
  }

  private parseToolCallDeltas(value: unknown): QwenToolCallDelta[] {
    if (!Array.isArray(value)) throw this.protocolError('Qwen tool_calls must be an array')
    return value.map((item) => {
      const call = record(item, 'Qwen tool call delta')
      if (!Number.isInteger(call.index) || (call.index as number) < 0) {
        throw this.protocolError('Qwen tool call index must be a non-negative integer')
      }
      if (call.id !== undefined && typeof call.id !== 'string') {
        throw this.protocolError('Qwen tool call id must be text')
      }
      const parsed: QwenToolCallDelta = { index: call.index as number }
      if (typeof call.id === 'string' && call.id) parsed.id = call.id
      if (call.function !== undefined && call.function !== null) {
        const fn = record(call.function, 'Qwen tool call function')
        if (fn.name !== undefined && typeof fn.name !== 'string') {
          throw this.protocolError('Qwen tool call function name must be text')
        }
        if (fn.arguments !== undefined && typeof fn.arguments !== 'string') {
          throw this.protocolError('Qwen tool call arguments must be text')
        }
        if (typeof fn.name === 'string' && fn.name) parsed.name = fn.name
        if (typeof fn.arguments === 'string') parsed.argumentsDelta = fn.arguments
      }
      return parsed
    })
  }

  private parseUsage(value: unknown): ChatAdapterUsage {
    const usage = record(value, 'Qwen usage')
    return {
      inputTokens: nonNegativeInteger(usage.prompt_tokens, 'Qwen prompt_tokens'),
      outputTokens: nonNegativeInteger(usage.completion_tokens, 'Qwen completion_tokens'),
      totalTokens: nonNegativeInteger(usage.total_tokens, 'Qwen total_tokens'),
      usageUnknown: false,
    }
  }

  private streamError(value: unknown): ChatAdapterError {
    const error = record(value, 'Qwen stream error')
    const message =
      typeof error.message === 'string' && error.message.trim()
        ? error.message
        : 'Qwen returned an error event'
    return new ChatAdapterError(message, {
      code: 'QWEN_STREAM_ERROR',
      retryable: false,
    })
  }

  private mapError(error: unknown): unknown {
    if (error instanceof ChatAdapterError) return error
    if (error instanceof OpenAICompatibleTimeoutError) {
      return new ChatAdapterError('Qwen request timed out', {
        code: 'QWEN_TIMEOUT',
        retryable: true,
        cause: error,
      })
    }
    if (error instanceof OpenAICompatibleHttpError) {
      return new ChatAdapterError(qwenHttpMessage(error.status), {
        code: qwenHttpCode(error.status),
        retryable: error.retryable,
        statusCode: error.status,
        ...(error.providerRequestId === undefined
          ? {}
          : { providerRequestId: error.providerRequestId }),
        cause: error,
      })
    }
    if (error instanceof OpenAICompatibleProtocolError) {
      return new ChatAdapterError('Qwen returned an invalid streaming response', {
        code: 'QWEN_PROTOCOL_ERROR',
        retryable: true,
        cause: error,
      })
    }
    return new ChatAdapterError('Qwen request failed', {
      code: 'QWEN_REQUEST_FAILED',
      retryable: true,
      cause: error,
    })
  }

  private protocolError(message: string): ChatAdapterError {
    return new ChatAdapterError(message, {
      code: 'QWEN_PROTOCOL_ERROR',
      retryable: true,
    })
  }
}

interface QwenToolCallDelta {
  index: number
  id?: string
  name?: string
  argumentsDelta?: string
}

interface PendingQwenToolCall {
  id?: string
  name?: string
  argumentsText: string
}

function mergeToolCallDelta(
  pending: Map<number, PendingQwenToolCall>,
  delta: QwenToolCallDelta,
  protocolError: (message: string) => ChatAdapterError,
): void {
  const current = pending.get(delta.index) ?? { argumentsText: '' }
  if (delta.id !== undefined) {
    if (current.id !== undefined && current.id !== delta.id) {
      throw protocolError(`Qwen changed tool call id at index ${delta.index}`)
    }
    current.id = delta.id
  }
  if (delta.name !== undefined) {
    if (current.name !== undefined && current.name !== delta.name) {
      throw protocolError(`Qwen changed tool name at index ${delta.index}`)
    }
    current.name = delta.name
  }
  if (delta.argumentsDelta !== undefined) current.argumentsText += delta.argumentsDelta
  pending.set(delta.index, current)
}

function finalizeToolCalls(
  pending: ReadonlyMap<number, PendingQwenToolCall>,
  protocolError: (message: string) => ChatAdapterError,
): ChatAdapterToolCall[] {
  if (pending.size === 0) {
    throw protocolError('Qwen finished with tool_calls but supplied no tool-call fragments')
  }
  return [...pending.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, call]) => {
      if (!call.id) throw protocolError(`Qwen tool call ${index} is missing an id`)
      if (!call.name) throw protocolError(`Qwen tool call ${index} is missing a function name`)
      let args: unknown
      try {
        args = JSON.parse(call.argumentsText || '{}')
      } catch (error) {
        throw new ChatAdapterError(`Qwen tool call ${index} contains invalid JSON arguments`, {
          code: 'QWEN_PROTOCOL_ERROR',
          retryable: true,
          cause: error,
        })
      }
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        throw protocolError(`Qwen tool call ${index} arguments must decode to an object`)
      }
      return {
        id: call.id,
        name: call.name,
        arguments: args as Record<string, unknown>,
      }
    })
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ChatAdapterError(`${label} must be an object`, {
      code: 'QWEN_PROTOCOL_ERROR',
      retryable: true,
    })
  }
  return value as Record<string, unknown>
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new ChatAdapterError(`${label} must be a non-negative integer`, {
      code: 'QWEN_PROTOCOL_ERROR',
      retryable: true,
    })
  }
  return value as number
}

function mapFinishReason(value: string): ChatFinishReason {
  if (
    value === 'stop' ||
    value === 'length' ||
    value === 'content_filter' ||
    value === 'tool_calls'
  ) {
    return value
  }
  return 'unknown'
}

function qwenHttpCode(status: number): string {
  if (status === 400 || status === 422) return 'QWEN_BAD_REQUEST'
  if (status === 401) return 'QWEN_AUTHENTICATION_ERROR'
  if (status === 403) return 'QWEN_ACCESS_DENIED'
  if (status === 404) return 'QWEN_MODEL_NOT_FOUND'
  if (status === 408) return 'QWEN_TIMEOUT'
  if (status === 429) return 'QWEN_RATE_LIMITED'
  if (status >= 500) return 'QWEN_UPSTREAM_UNAVAILABLE'
  return 'QWEN_HTTP_ERROR'
}

function qwenHttpMessage(status: number): string {
  if (status === 401 || status === 403) return 'Qwen authentication or access was rejected'
  if (status === 404) return 'Qwen model was not found or is not accessible'
  if (status === 429) return 'Qwen rate limit was exceeded'
  if (status >= 500) return 'Qwen service is temporarily unavailable'
  return `Qwen request was rejected with HTTP ${status}`
}

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) throw new TypeError(`${label} must be non-empty`)
  return normalized
}

function chatCompletionsEndpoint(baseUrl: string): string {
  const normalized = requireNonEmpty(baseUrl, 'Qwen baseUrl')
  const url = new URL(normalized.endsWith('/') ? normalized : `${normalized}/`)
  if (url.protocol !== 'https:') throw new TypeError('Qwen baseUrl must use HTTPS')
  return new URL('chat/completions', url).toString()
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
}
