import type { ChatAdapter } from './adapters/chat-adapter'
import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { ModelsController } from './models.controller'
import type { ProviderHealthService } from './provider-health.service'

function adapter(id: ChatAdapter['id']): ChatAdapter {
  return {
    id,
    resolvedModel: `${id}-model`,
    stream: jest.fn(),
  }
}

describe('ModelsController', () => {
  const providerHealth = {
    getStatus: jest.fn(async (provider: string) =>
      provider === 'qwen' ? ('healthy' as const) : ('unhealthy' as const),
    ),
  } as unknown as ProviderHealthService

  it('returns only enabled public aliases with their passive health summary', async () => {
    const controller = new ModelsController(
      new ChatAdapterRegistry([adapter('mock'), adapter('qwen'), adapter('deepseek')]),
      providerHealth,
    )

    await expect(controller.list()).resolves.toEqual([
      {
        alias: 'qwen',
        capabilities: ['chat', 'prompt'],
        displayName: '通义千问',
        enabled: true,
        configured: true,
        health: 'healthy',
      },
      {
        alias: 'deepseek',
        capabilities: ['chat', 'prompt'],
        displayName: 'DeepSeek',
        enabled: true,
        configured: true,
        health: 'unhealthy',
      },
    ])
  })

  it('exposes a stable public alias without querying health in a Mock-only environment', async () => {
    const controller = new ModelsController(
      new ChatAdapterRegistry([adapter('mock')]),
      providerHealth,
    )

    await expect(controller.list()).resolves.toEqual([
      {
        alias: 'qwen',
        capabilities: ['chat', 'prompt'],
        displayName: '通义千问（Mock）',
        enabled: true,
        configured: false,
        health: 'unknown',
      },
    ])
    expect(providerHealth.getStatus).not.toHaveBeenCalledWith('mock')
  })
})
