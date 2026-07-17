import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAIGatewayClient } from './client.js'
import type { ChatEvent, TextModelAlias } from './types.js'

describe('AIGatewayClient chat.compare', () => {
  it('creates independent comparison requests and cancelling one run does not stop another', async () => {
    const calls: Array<{ model: TextModelAlias; comparison: boolean; signal?: AbortSignal }> = []
    const client = createAIGatewayClient({
      fetch: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as {
          model: TextModelAlias
          comparison: boolean
        }
        calls.push({
          model: body.model,
          comparison: body.comparison,
          ...(init?.signal === null || init?.signal === undefined ? {} : { signal: init.signal }),
        })
        if (body.model === 'qwen') return waitForAbort(init?.signal)
        return comparisonResponse(body.model)
      },
    })
    const session = client.chat.compare({
      models: ['qwen', 'glm'],
      messages: [{ role: 'user', content: '比较回答' }],
      temperature: 0.5,
    })

    const qwenIterator = session.runs[0]!.events[Symbol.asyncIterator]()
    const qwenPending = qwenIterator.next()
    const glmEvents = collect(session.runs[1]!.events)
    session.runs[0]!.cancel(new DOMException('single cancelled', 'AbortError'))

    await assert.rejects(qwenPending, { name: 'AbortError' })
    assert.deepEqual(
      (await glmEvents).map(({ type }) => type),
      ['start', 'delta', 'usage', 'done'],
    )
    assert.deepEqual(
      calls.map(({ model, comparison }) => ({ model, comparison })),
      [
        { model: 'qwen', comparison: true },
        { model: 'glm', comparison: true },
      ],
    )
    assert.notEqual(calls[0]?.signal, calls[1]?.signal)
    assert.equal(calls[0]?.signal?.aborted, true)
    assert.equal(calls[1]?.signal?.aborted, false)
  })

  it('cancels every independent controller and validates model count and uniqueness', async () => {
    const signals: AbortSignal[] = []
    const client = createAIGatewayClient({
      fetch: async (_input, init) => {
        if (init?.signal) signals.push(init.signal)
        return waitForAbort(init?.signal)
      },
    })
    const session = client.chat.compare({
      models: ['qwen', 'glm', 'deepseek'],
      messages: [{ role: 'user', content: '全部取消' }],
    })
    const pending = session.runs.map((run) => run.events[Symbol.asyncIterator]().next())
    session.cancelAll(new DOMException('all cancelled', 'AbortError'))

    await Promise.all(pending.map((request) => assert.rejects(request, { name: 'AbortError' })))
    assert.equal(new Set(signals).size, 3)
    assert.ok(signals.every(({ aborted }) => aborted))
    assert.throws(() => client.chat.compare({ models: ['qwen'], messages: [] }), /requires 2 or 3/)
    assert.throws(
      () => client.chat.compare({ models: ['qwen', 'qwen'], messages: [] }),
      /must be unique/,
    )
  })
})

async function collect(events: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const collected: ChatEvent[] = []
  for await (const event of events) collected.push(event)
  return collected
}

function waitForAbort(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

function comparisonResponse(model: TextModelAlias): Response {
  const requestId = `request-${model}`
  const encoder = new TextEncoder()
  const payloads = [
    {
      id: requestId,
      object: 'chat.completion.chunk',
      created: 1,
      model,
      request_id: requestId,
      choices: [{ index: 0, delta: { content: `${model} reply` }, finish_reason: null }],
    },
    {
      id: requestId,
      object: 'chat.completion.usage',
      created: 1,
      model,
      request_id: requestId,
      choices: [],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
        aigateway: { estimated_cost_cny: '0.000001', usage_unknown: false },
      },
    },
  ]
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `${payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`).join('')}data: [DONE]\n\n`,
          ),
        )
        controller.close()
      },
    }),
    { headers: { 'content-type': 'text/event-stream', 'x-request-id': requestId } },
  )
}
