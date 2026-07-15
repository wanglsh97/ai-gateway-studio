import type { ChatMessage } from '@aigateway/sdk'

import type { ChatAdapterEvent, ChatAdapterRequest } from './chat-adapter'
import { ChatAdapterError } from './chat-adapter'
import { MockChatAdapter } from './mock-chat-adapter'

const messages: ChatMessage[] = [{ role: 'user', content: 'abcd' }]

function request(controller = new AbortController()): ChatAdapterRequest {
  return {
    requestId: '00000000-0000-4000-8000-000000000001',
    modelAlias: 'qwen',
    resolvedModel: 'mock-chat-v1',
    messages,
    signal: controller.signal,
  }
}

async function collect(adapter: MockChatAdapter, input = request()): Promise<ChatAdapterEvent[]> {
  const events: ChatAdapterEvent[] = []
  for await (const event of adapter.stream(input)) events.push(event)
  return events
}

describe('MockChatAdapter', () => {
  it('emits deterministic delayed deltas, usage and completion', async () => {
    const adapter = new MockChatAdapter({ chunks: ['12345'], delayMs: 10 })
    const startedAt = Date.now()

    const events = await collect(adapter)

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(8)
    expect(events).toEqual([
      {
        type: 'delta',
        content: '12345',
        providerRequestId: 'mock-00000000-0000-4000-8000-000000000001',
      },
      {
        type: 'usage',
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3, usageUnknown: false },
        providerRequestId: 'mock-00000000-0000-4000-8000-000000000001',
      },
      {
        type: 'finish',
        finishReason: 'stop',
        providerRequestId: 'mock-00000000-0000-4000-8000-000000000001',
      },
    ])
  })

  it('supports a configured failure before the first delta', async () => {
    const adapter = new MockChatAdapter({
      chunks: ['never emitted'],
      delayMs: 0,
      failure: { phase: 'before-first-delta', code: 'MOCK_BEFORE_DELTA' },
    })

    await expect(collect(adapter)).rejects.toMatchObject<Partial<ChatAdapterError>>({
      name: 'ChatAdapterError',
      code: 'MOCK_BEFORE_DELTA',
      retryable: true,
      statusCode: 503,
    })
  })

  it('supports a configured failure after streaming has started', async () => {
    const adapter = new MockChatAdapter({
      chunks: ['first', 'never emitted'],
      delayMs: 0,
      failure: { phase: 'after-first-delta', retryable: false },
    })
    const iterator = adapter.stream(request())[Symbol.asyncIterator]()

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: { type: 'delta', content: 'first' },
    })
    await expect(iterator.next()).rejects.toMatchObject({
      name: 'ChatAdapterError',
      code: 'MOCK_CHAT_FAILURE',
      retryable: false,
    })
  })

  it('cancels an in-flight delay without emitting an event', async () => {
    const controller = new AbortController()
    const adapter = new MockChatAdapter({ chunks: ['never emitted'], delayMs: 1_000 })
    const nextEvent = adapter.stream(request(controller))[Symbol.asyncIterator]().next()

    controller.abort()

    await expect(nextEvent).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects invalid deterministic configuration', () => {
    expect(() => new MockChatAdapter({ chunks: [], delayMs: 0 })).toThrow(TypeError)
    expect(() => new MockChatAdapter({ chunks: ['ok'], delayMs: -1 })).toThrow(TypeError)
  })
})
