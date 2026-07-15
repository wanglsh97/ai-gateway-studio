import type { ChatFinishReason, ChatMessage, TextModelAlias } from '@aigateway/sdk'

import type { ChatAdapterId } from '../chat.constants'

export interface ChatAdapterRequest {
  requestId: string
  modelAlias: TextModelAlias
  resolvedModel: string
  messages: readonly ChatMessage[]
  signal: AbortSignal
  temperature?: number
  topP?: number
  maxTokens?: number
}

export interface ChatAdapterUsage {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  usageUnknown: boolean
}

export type ChatAdapterEvent =
  | {
      type: 'delta'
      content: string
      providerRequestId?: string
    }
  | {
      type: 'usage'
      usage: ChatAdapterUsage
      providerRequestId?: string
    }
  | {
      type: 'finish'
      finishReason: ChatFinishReason
      providerRequestId?: string
    }

export interface ChatAdapter {
  readonly id: ChatAdapterId
  readonly resolvedModel: string
  stream(request: ChatAdapterRequest): AsyncIterable<ChatAdapterEvent>
}

export interface ChatAdapterErrorOptions {
  code: string
  retryable: boolean
  statusCode?: number
  providerRequestId?: string
  cause?: unknown
}

export class ChatAdapterError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly statusCode: number | undefined
  readonly providerRequestId: string | undefined

  constructor(message: string, options: ChatAdapterErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'ChatAdapterError'
    this.code = options.code
    this.retryable = options.retryable
    this.statusCode = options.statusCode
    this.providerRequestId = options.providerRequestId
  }
}
