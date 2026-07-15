import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { OpenAICompatibleFetch } from '../transports/openai-compatible-chat.transport'
import { OpenAICompatibleChatTransport } from '../transports/openai-compatible-chat.transport'
import { KimiChatAdapter } from './kimi-chat-adapter'
import { describeChatAdapterContract } from './testing/chat-adapter.contract'

const fixture = readFileSync(join(__dirname, 'testing/fixtures/kimi-chat-success.sse'), 'utf8')

function adapter(fetch: OpenAICompatibleFetch): KimiChatAdapter {
  return new KimiChatAdapter(new OpenAICompatibleChatTransport({ fetch, timeoutMs: 1_000 }), {
    apiKey: 'sanitized-kimi-key',
    baseUrl: 'https://kimi.example/v1',
    modelId: 'kimi-fixture',
  })
}

describeChatAdapterContract({
  name: 'Kimi',
  adapterId: 'kimi',
  requestOverrides: { modelAlias: 'kimi', resolvedModel: 'kimi-fixture' },
  createSuccessCase: () => {
    const calls: Array<{ input: string; init?: RequestInit }> = []
    return {
      adapter: adapter(async (input, init) => {
        calls.push({ input: String(input), ...(init === undefined ? {} : { init }) })
        return new Response(fixture, { headers: { 'content-type': 'text/event-stream' } })
      }),
      expectedDeltas: ['你好', '，我是 Kimi。'],
      expectedUsage: { inputTokens: 11, outputTokens: 7, totalTokens: 18, usageUnknown: false },
      expectedFinishReason: 'stop',
      expectedProviderRequestId: 'cmpl-kimi-sanitized-1',
      assertRequest: () => {
        expect(calls[0]?.input).toBe('https://kimi.example/v1/chat/completions')
        expect(calls[0]?.init).toMatchObject({
          headers: { authorization: 'Bearer sanitized-kimi-key' },
          body: JSON.stringify({
            model: 'kimi-fixture',
            messages: [
              { role: 'system', content: 'You are concise.' },
              { role: 'user', content: 'Reply with a short greeting.' },
            ],
            stream: true,
            temperature: 0.7,
            top_p: 0.8,
            max_tokens: 321,
          }),
        })
      },
    }
  },
  createErrorCase: () => ({
    adapter: adapter(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { type: 'invalid_authentication_error' } }), {
          status: 401,
          headers: { 'x-request-id': 'kimi-failed-1' },
        }),
      ),
    ),
    expectedError: {
      code: 'KIMI_AUTHENTICATION_ERROR',
      retryable: false,
      statusCode: 401,
      providerRequestId: 'kimi-failed-1',
    },
  }),
  createCancellationCase: () => ({
    adapter: adapter(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        }),
    ),
  }),
})

describe('KimiChatAdapter', () => {
  it('rejects insecure Moonshot endpoints before sending credentials', () => {
    expect(
      () =>
        new KimiChatAdapter(new OpenAICompatibleChatTransport(), {
          apiKey: 'sanitized',
          baseUrl: 'http://kimi.example/v1',
          modelId: 'kimi-fixture',
        }),
    ).toThrow('must use HTTPS')
  })
})
