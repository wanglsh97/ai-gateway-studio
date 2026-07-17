import { EventEmitter } from 'node:events'

import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

import type { PricingService } from '../billing/pricing.service'
import type { ChatAdapter } from '../chat/adapters/chat-adapter'
import { ChatAdapterRegistry } from '../chat/adapters/chat-adapter.registry'
import type { RateLimitService } from '../rate-limit/rate-limit.service'
import type { RequestLifecycleService } from '../request-lifecycle/request-lifecycle.service'
import { PromptController } from './prompt.controller'
import { PromptTemplateRegistry } from './prompt-template.registry'

function setup(error?: Error) {
  const stream = jest.fn(() =>
    (async function* () {
      yield { type: 'delta' as const, content: '优化后的' }
      if (error) throw error
      yield { type: 'delta' as const, content: ' Prompt' }
      yield {
        type: 'usage' as const,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, usageUnknown: false },
      }
      yield { type: 'finish' as const, finishReason: 'stop' as const }
    })(),
  )
  const adapter: ChatAdapter = { id: 'mock', resolvedModel: 'mock-chat-v1', stream }
  const consumeChat = jest.fn().mockResolvedValue(undefined)
  const rateLimit = { consumeChat } as unknown as RateLimitService
  const start = jest.fn().mockResolvedValue({
    id: 'log-1',
    requestId: '00000000-0000-4000-8000-000000000130',
    startedAt: new Date('2026-07-17T00:00:00.000Z'),
  })
  const finish = jest.fn().mockResolvedValue(undefined)
  const lifecycle = { start, finish } as unknown as RequestLifecycleService
  const calculate = jest.fn((_provider, usage) => ({
    ...usage,
    priceVersion: 'mock-v1',
    estimatedCostCny: '0.00000000',
  }))
  const pricing = { calculate } as unknown as PricingService
  const controller = new PromptController(
    new ConfigService({ PROMPT_OPTIMIZER_MODEL: 'qwen' }),
    new ChatAdapterRegistry([adapter]),
    new PromptTemplateRegistry(),
    lifecycle,
    rateLimit,
    pricing,
  )
  const request = Object.assign(new EventEmitter(), {
    id: '00000000-0000-4000-8000-000000000130',
    ip: '127.0.0.1',
  }) as unknown as Request & { id: string }
  return { calculate, consumeChat, controller, finish, request, start, stream }
}

describe('PromptController', () => {
  it('uses a server template and the shared gateway lifecycle for optimization', async () => {
    const { calculate, consumeChat, controller, finish, request, start, stream } = setup()

    await expect(
      controller.optimize({ prompt: '帮我写代码', mode: 'structure' }, request),
    ).resolves.toEqual({
      requestId: request.id,
      model: 'qwen',
      optimizedPrompt: '优化后的 Prompt',
      templateVersion: '2026-07-v1',
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        estimatedCostCny: '0.00000000',
        usageUnknown: false,
      },
    })
    expect(consumeChat).toHaveBeenCalledWith('127.0.0.1')
    expect(start.mock.invocationCallOrder[0]).toBeLessThan(stream.mock.invocationCallOrder[0] ?? 0)
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: 'prompt',
        prompt: expect.objectContaining({ mode: 'structure', templateVersion: '2026-07-v1' }),
      }),
    )
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({ role: 'system', content: expect.stringContaining('结构化') }),
          { role: 'user', content: '帮我写代码' },
        ],
      }),
    )
    expect(calculate).toHaveBeenCalledWith('mock', expect.objectContaining({ totalTokens: 15 }))
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', usage: expect.any(Object) }),
    )
  })

  it('finalizes a provider failure without returning a partial optimization', async () => {
    const { controller, finish, request } = setup(new Error('upstream failed'))

    await expect(
      controller.optimize({ prompt: '原始 Prompt', mode: 'expand' }, request),
    ).rejects.toThrow('upstream failed')
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'PROMPT_OPTIMIZATION_FAILED' }),
      }),
    )
  })
})
