import { Inject, Injectable } from '@nestjs/common'

import type {
  ChatAdapter,
  ChatAdapterEvent,
  ChatAdapterRequest,
  ChatAdapterUsage,
} from './chat-adapter'
import { ChatAdapterError } from './chat-adapter'

export type MockChatFailurePhase = 'before-first-delta' | 'after-first-delta'

export interface MockChatFailure {
  phase: MockChatFailurePhase
  code?: string
  message?: string
  retryable?: boolean
  statusCode?: number
}

export interface MockChatAdapterOptions {
  chunks: readonly string[]
  delayMs: number
  usage?: ChatAdapterUsage
  failure?: MockChatFailure
}

export const MOCK_CHAT_ADAPTER_OPTIONS = Symbol('MOCK_CHAT_ADAPTER_OPTIONS')

export const DEFAULT_MOCK_CHAT_ADAPTER_OPTIONS: MockChatAdapterOptions = Object.freeze({
  chunks: Object.freeze(['这是 ', 'Mock Adapter ', '的确定性流式响应。']),
  delayMs: 25,
})

@Injectable()
export class MockChatAdapter implements ChatAdapter {
  readonly id = 'mock' as const
  readonly resolvedModel = 'mock-chat-v1'

  constructor(@Inject(MOCK_CHAT_ADAPTER_OPTIONS) private readonly options: MockChatAdapterOptions) {
    if (!Number.isInteger(options.delayMs) || options.delayMs < 0) {
      throw new TypeError('Mock Chat delayMs must be a non-negative integer')
    }
    if (options.chunks.length === 0 || options.chunks.some((chunk) => chunk.length === 0)) {
      throw new TypeError('Mock Chat chunks must contain at least one non-empty chunk')
    }
  }

  async *stream(request: ChatAdapterRequest): AsyncIterable<ChatAdapterEvent> {
    const providerRequestId = `mock-${request.requestId}`

    if (this.options.failure?.phase === 'before-first-delta') {
      await this.waitForDelay(request.signal)
      throw this.createFailure(this.options.failure, providerRequestId)
    }

    for (const [index, content] of this.options.chunks.entries()) {
      await this.waitForDelay(request.signal)
      yield { type: 'delta', content, providerRequestId }

      if (index === 0 && this.options.failure?.phase === 'after-first-delta') {
        await this.waitForDelay(request.signal)
        throw this.createFailure(this.options.failure, providerRequestId)
      }
    }

    this.throwIfAborted(request.signal)
    yield {
      type: 'usage',
      usage: this.options.usage ?? this.calculateUsage(request),
      providerRequestId,
    }
    yield { type: 'finish', finishReason: 'stop', providerRequestId }
  }

  private calculateUsage(request: ChatAdapterRequest): ChatAdapterUsage {
    const inputText = request.messages.map((message) => message.content).join('')
    const outputText = this.options.chunks.join('')
    const inputTokens = this.estimateTokens(inputText)
    const outputTokens = this.estimateTokens(outputText)

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      usageUnknown: false,
    }
  }

  private estimateTokens(value: string): number {
    const codePoints = Array.from(value).length
    return codePoints === 0 ? 0 : Math.ceil(codePoints / 4)
  }

  private createFailure(failure: MockChatFailure, providerRequestId: string): ChatAdapterError {
    return new ChatAdapterError(failure.message ?? 'Configured Mock Chat failure', {
      code: failure.code ?? 'MOCK_CHAT_FAILURE',
      retryable: failure.retryable ?? true,
      statusCode: failure.statusCode ?? 503,
      providerRequestId,
    })
  }

  private async waitForDelay(signal: AbortSignal): Promise<void> {
    this.throwIfAborted(signal)
    if (this.options.delayMs === 0) return

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      }, this.options.delayMs)
      const onAbort = () => {
        clearTimeout(timer)
        reject(this.abortError())
      }

      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) throw this.abortError()
  }

  private abortError(): DOMException {
    return new DOMException('The operation was aborted', 'AbortError')
  }
}
