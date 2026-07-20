import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAIGatewayClient } from './client.js'
import { AIGatewayAuthenticationError, AIGatewayError, AIGatewayProtocolError } from './errors.js'
import type { ChatEvent, ChatRequest } from './types.js'

const requestId = '00000000-0000-4000-8000-000000000005'
const input: ChatRequest = {
  model: 'qwen',
  messages: [{ role: 'user', content: '你好' }],
  stream: true,
}

function streamResponse(chunks: readonly string[], onCancel?: () => void): Response {
  const encoder = new TextEncoder()
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index]
      if (chunk === undefined) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunk))
      index += 1
    },
    cancel() {
      onCancel?.()
    },
  })
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'x-request-id': requestId,
    },
  })
}

function frame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

function delta(content: string) {
  return {
    id: `chatcmpl-${requestId}`,
    object: 'chat.completion.chunk',
    created: 1,
    model: 'qwen',
    request_id: requestId,
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  }
}

function usage() {
  return {
    id: `chatcmpl-${requestId}`,
    object: 'chat.completion.usage',
    created: 1,
    model: 'qwen',
    request_id: requestId,
    choices: [],
    usage: {
      prompt_tokens: 2,
      completion_tokens: 3,
      total_tokens: 5,
      aigateway: { estimated_cost_cny: '0.00100000', usage_unknown: false },
    },
  }
}

async function collect(events: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const collected: ChatEvent[] = []
  for await (const event of events) collected.push(event)
  return collected
}

describe('createAIGatewayClient chat.stream', () => {
  it('parses fragmented POST SSE into typed start, delta, usage and done events', async () => {
    const sse = `${frame(delta('第一段'))}${frame(delta('第二段'))}${frame(usage())}data: [DONE]\n\n`
    const fetchCalls: Array<{ input: string; init?: RequestInit }> = []
    const fetchImplementation = async (fetchInput: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input: String(fetchInput), ...(init === undefined ? {} : { init }) })
      return streamResponse([sse.slice(0, 17), sse.slice(17, 73), sse.slice(73)])
    }
    const client = createAIGatewayClient({
      baseUrl: 'http://localhost:3001/',
      fetch: fetchImplementation,
    })

    const events = await collect(client.chat.stream(input))

    assert.deepEqual(events, [
      { type: 'start', requestId, model: 'qwen' },
      { type: 'delta', requestId, content: '第一段' },
      { type: 'delta', requestId, content: '第二段' },
      {
        type: 'usage',
        requestId,
        usage: {
          inputTokens: 2,
          outputTokens: 3,
          totalTokens: 5,
          estimatedCostCny: '0.00100000',
          usageUnknown: false,
        },
      },
      { type: 'done', requestId },
    ])
    assert.equal(fetchCalls[0]?.input, 'http://localhost:3001/api/v1/chat/completions')
    assert.equal(fetchCalls[0]?.init?.method, 'POST')
    assert.equal(fetchCalls[0]?.init?.credentials, 'same-origin')
    assert.equal(fetchCalls[0]?.init?.body, JSON.stringify(input))
  })

  it('throws a non-retryable typed authentication error for 401 responses', async () => {
    const client = createAIGatewayClient({
      fetch: async () =>
        Response.json(
          {
            requestId,
            code: 'UNAUTHORIZED',
            message: '用户会话无效或已过期',
            retryable: false,
          },
          { status: 401 },
        ),
    })

    await assert.rejects(
      () => client.chat.stream(input)[Symbol.asyncIterator]().next(),
      (error: unknown) =>
        error instanceof AIGatewayAuthenticationError &&
        error.status === 401 &&
        error.code === 'UNAUTHORIZED' &&
        error.retryable === false,
    )
  })

  it('throws a typed HTTP error envelope before opening a stream', async () => {
    const client = createAIGatewayClient({
      fetch: async () =>
        new Response(
          JSON.stringify({
            requestId,
            code: 'RATE_LIMITED',
            message: '请求过于频繁',
            retryable: true,
          }),
          { status: 429, headers: { 'x-request-id': requestId } },
        ),
    })

    await assert.rejects(
      () => client.chat.stream(input)[Symbol.asyncIterator]().next(),
      (error: unknown) =>
        error instanceof AIGatewayError &&
        error.code === 'RATE_LIMITED' &&
        error.requestId === requestId &&
        error.status === 429,
    )
  })

  it('rejects streams without exactly one DONE or exactly one usage payload', async () => {
    const missingDone = createAIGatewayClient({
      fetch: async () => streamResponse([frame(delta('内容')), frame(usage())]),
    })
    await assert.rejects(() => collect(missingDone.chat.stream(input)), AIGatewayProtocolError)

    const duplicateDone = createAIGatewayClient({
      fetch: async () =>
        streamResponse([
          `${frame(delta('内容'))}${frame(usage())}data: [DONE]\n\ndata: [DONE]\n\n`,
        ]),
    })
    await assert.rejects(() => collect(duplicateDone.chat.stream(input)), AIGatewayProtocolError)
  })

  it('returns a typed error event for an established failed stream', async () => {
    const errorPayload = {
      object: 'chat.completion.error',
      request_id: requestId,
      error: {
        requestId,
        code: 'MOCK_STREAM_FAILURE',
        message: '流中失败',
        retryable: false,
      },
    }
    const client = createAIGatewayClient({
      fetch: async () => streamResponse([frame(errorPayload)]),
    })

    const events = await collect(client.chat.stream(input))

    assert.deepEqual(events, [
      { type: 'start', requestId, model: 'qwen' },
      {
        type: 'error',
        requestId,
        error: {
          requestId,
          code: 'MOCK_STREAM_FAILURE',
          message: '流中失败',
          retryable: false,
        },
      },
    ])
  })

  it('cancels the response body when the consumer stops reading', async () => {
    let cancelled = false
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(frame(delta('第一段'))))
      },
      cancel() {
        cancelled = true
      },
    })
    const client = createAIGatewayClient({
      fetch: async () =>
        new Response(body, {
          headers: {
            'content-type': 'text/event-stream',
            'x-request-id': requestId,
          },
        }),
    })
    const iterator = client.chat.stream(input)[Symbol.asyncIterator]()

    assert.equal((await iterator.next()).value?.type, 'start')
    assert.equal((await iterator.next()).value?.type, 'delta')
    await iterator.return?.()

    assert.equal(cancelled, true)
  })
})

describe('createAIGatewayClient models.list', () => {
  it('fetches and returns typed enabled model summaries', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = []
    const models = [
      {
        alias: 'qwen',
        modelId: 'qwen-plus',
        capabilities: ['chat', 'prompt'],
        displayName: '通义千问',
        enabled: true,
        configured: true,
        health: 'unknown',
      },
    ]
    const client = createAIGatewayClient({
      baseUrl: 'http://localhost:3001/',
      fetch: async (fetchInput, init) => {
        calls.push({ input: String(fetchInput), ...(init === undefined ? {} : { init }) })
        return Response.json(models)
      },
    })

    assert.deepEqual(await client.models.list(), models)
    assert.equal(calls[0]?.input, 'http://localhost:3001/api/v1/models')
    assert.equal(calls[0]?.init?.method, 'GET')
  })

  it('rejects malformed model summaries', async () => {
    const client = createAIGatewayClient({
      fetch: async () => Response.json([{ alias: 'secret-provider-model-id' }]),
    })

    await assert.rejects(() => client.models.list(), AIGatewayProtocolError)
  })
})
