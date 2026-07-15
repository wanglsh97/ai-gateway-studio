import { EventEmitter } from 'node:events'

import type { ChatFinishReason } from '@aigateway/sdk'
import type { Request, Response } from 'express'

import type { RequestLifecycleService } from '../request-lifecycle/request-lifecycle.service'
import { RequestLifecycleStartError } from '../request-lifecycle/request-lifecycle.service'
import type { ChatAdapter, ChatAdapterEvent } from './adapters/chat-adapter'
import { ChatAdapterError } from './adapters/chat-adapter'
import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { ChatController } from './chat.controller'
import type { ChatCompletionRequestDto } from './dto/chat-completion-request.dto'

const requestId = '00000000-0000-4000-8000-000000000003'
const input: ChatCompletionRequestDto = {
  model: 'qwen',
  messages: [{ role: 'user', content: '完整消息' }],
  stream: true,
}

function httpDoubles() {
  const request = Object.assign(new EventEmitter(), {
    id: requestId,
    ip: '127.0.0.1',
  }) as unknown as Request & { id: string }
  const writes: string[] = []
  const rawResponse = Object.assign(new EventEmitter(), {
    destroyed: false,
    writableEnded: false,
    status: jest.fn(),
    set: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((value: string) => {
      writes.push(value)
      return true
    }),
    end: jest.fn(),
  })
  rawResponse.status.mockImplementation(() => rawResponse)
  rawResponse.set.mockImplementation(() => rawResponse)
  rawResponse.end.mockImplementation(() => {
    rawResponse.writableEnded = true
    return rawResponse
  })

  return { request, response: rawResponse as unknown as Response, rawResponse, writes }
}

function adapterWith(events: readonly ChatAdapterEvent[], error?: Error) {
  const stream = jest.fn(() =>
    (async function* () {
      for (const event of events) yield event
      if (error) throw error
    })(),
  )
  const adapter: ChatAdapter = { id: 'mock', stream }
  return { adapter, stream }
}

function controllerFor(adapter: ChatAdapter) {
  const start = jest.fn().mockResolvedValue({
    id: 'log-1',
    requestId,
    status: 'PENDING',
    startedAt: new Date('2026-07-15T00:00:00.000Z'),
  })
  const finish = jest.fn().mockResolvedValue(undefined)
  const lifecycle = { start, finish } as unknown as RequestLifecycleService
  const controller = new ChatController(new ChatAdapterRegistry([adapter]), lifecycle)
  return { controller, finish, start }
}

function frameData(writes: readonly string[]) {
  return writes.map((frame) => frame.replace(/^data: /, '').trim())
}

describe('ChatController', () => {
  it('persists pending first, then streams delta, usage and exactly one DONE', async () => {
    const { adapter, stream } = adapterWith([
      { type: 'delta', content: '第一段' },
      { type: 'delta', content: '第二段' },
      {
        type: 'usage',
        usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5, usageUnknown: false },
      },
      { type: 'finish', finishReason: 'stop' },
    ])
    const { controller, finish, start } = controllerFor(adapter)
    const { request, response, rawResponse, writes } = httpDoubles()

    await controller.create(input, request, response)

    expect(start.mock.invocationCallOrder[0]).toBeLessThan(stream.mock.invocationCallOrder[0] ?? 0)
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        prompt: { messages: [{ role: 'user', content: '完整消息' }] },
        provider: 'mock',
        resolvedModel: 'mock-chat-v1',
      }),
    )
    expect(rawResponse.flushHeaders).toHaveBeenCalledTimes(1)
    expect(rawResponse.end).toHaveBeenCalledTimes(1)
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({
        requestLogId: 'log-1',
        requestId,
        status: 'succeeded',
        usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5, usageUnknown: false },
      }),
    )

    const data = frameData(writes)
    expect(data.filter((value) => value === '[DONE]')).toHaveLength(1)
    expect(finish.mock.invocationCallOrder[0]).toBeLessThan(
      rawResponse.write.mock.invocationCallOrder.at(-1) ?? 0,
    )
    const payloads = data.slice(0, -1).map((value) => JSON.parse(value) as Record<string, unknown>)
    expect(payloads.map((payload) => payload.object)).toEqual([
      'chat.completion.chunk',
      'chat.completion.chunk',
      'chat.completion.chunk',
      'chat.completion.usage',
    ])
    expect(payloads[3]).toMatchObject({
      request_id: requestId,
      usage: {
        prompt_tokens: 2,
        completion_tokens: 3,
        total_tokens: 5,
        aigateway: { estimated_cost_cny: null, usage_unknown: false },
      },
    })
  })

  it('emits a normalized SSE error without DONE after the stream is open', async () => {
    const { adapter } = adapterWith(
      [{ type: 'delta', content: '部分内容' }],
      new ChatAdapterError('上游流中失败', {
        code: 'MOCK_STREAM_FAILURE',
        retryable: false,
      }),
    )
    const { controller, finish } = controllerFor(adapter)
    const { request, response, writes } = httpDoubles()

    await controller.create(input, request, response)

    const data = frameData(writes)
    expect(data).not.toContain('[DONE]')
    expect(JSON.parse(data.at(-1) ?? '{}')).toEqual({
      object: 'chat.completion.error',
      request_id: requestId,
      error: {
        requestId,
        code: 'MOCK_STREAM_FAILURE',
        message: '上游流中失败',
        retryable: false,
      },
    })
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: {
          code: 'MOCK_STREAM_FAILURE',
          message: '上游流中失败',
          details: { retryable: false },
        },
      }),
    )
  })

  it('does not open the stream or invoke the adapter when persistence fails', async () => {
    const { adapter, stream } = adapterWith([])
    const { controller, start } = controllerFor(adapter)
    start.mockRejectedValue(new RequestLifecycleStartError(new Error('database unavailable')))
    const { request, response, rawResponse } = httpDoubles()

    await expect(controller.create(input, request, response)).rejects.toBeInstanceOf(
      RequestLifecycleStartError,
    )
    expect(rawResponse.flushHeaders).not.toHaveBeenCalled()
    expect(stream).not.toHaveBeenCalled()
  })

  it('rejects adapter streams that omit usage', async () => {
    const finishReason: ChatFinishReason = 'stop'
    const { adapter } = adapterWith([
      { type: 'delta', content: '内容' },
      { type: 'finish', finishReason },
    ])
    const { controller } = controllerFor(adapter)
    const { request, response, writes } = httpDoubles()

    await controller.create(input, request, response)

    const error = JSON.parse(frameData(writes).at(-1) ?? '{}') as Record<string, unknown>
    expect(error).toMatchObject({
      object: 'chat.completion.error',
      error: { code: 'ADAPTER_PROTOCOL_ERROR', retryable: false },
    })
  })

  it('finalizes a disconnected stream as cancelled', async () => {
    let markStreamStarted!: () => void
    const streamStarted = new Promise<void>((resolve) => {
      markStreamStarted = resolve
    })
    const adapter: ChatAdapter = {
      id: 'mock',
      async *stream(adapterRequest) {
        markStreamStarted()
        await new Promise<void>((resolve, reject) => {
          void resolve
          adapterRequest.signal.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          )
        })
        yield { type: 'finish', finishReason: 'stop' }
      },
    }
    const { controller, finish } = controllerFor(adapter)
    const { request, response, rawResponse } = httpDoubles()

    const operation = controller.create(input, request, response)
    await streamStarted
    rawResponse.destroyed = true
    rawResponse.emit('close')
    await operation

    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', requestLogId: 'log-1' }),
    )
  })
})
