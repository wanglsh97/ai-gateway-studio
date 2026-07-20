import type { ChatAdapter } from './adapters/chat-adapter'
import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import type { ImageAdapter } from '../image/adapters/image-adapter'
import { ImageAdapterRegistry } from '../image/adapters/image-adapter.registry'
import { ModelsController } from './models.controller'
import type { ProviderHealthService } from './provider-health.service'

function adapter(id: ChatAdapter['id']): ChatAdapter {
  return {
    id,
    resolvedModel: `${id}-model`,
    stream: jest.fn(),
  }
}

function imageAdapter(id: ImageAdapter['id']): ImageAdapter {
  return {
    id,
    resolvedModel: `${id}-image-model`,
    submit: jest.fn(),
    getStatus: jest.fn(),
    download: jest.fn(),
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
      new ImageAdapterRegistry([imageAdapter('wanxiang'), imageAdapter('cogview')]),
    )

    await expect(controller.list()).resolves.toEqual([
      {
        alias: 'qwen',
        modelId: 'qwen-model',
        capabilities: ['chat', 'prompt'],
        displayName: '通义千问',
        enabled: true,
        configured: true,
        health: 'healthy',
      },
      {
        alias: 'deepseek',
        modelId: 'deepseek-model',
        capabilities: ['chat', 'prompt'],
        displayName: 'DeepSeek',
        enabled: true,
        configured: true,
        health: 'unhealthy',
      },
      {
        alias: 'wanxiang',
        modelId: 'wanxiang-image-model',
        capabilities: ['image'],
        displayName: '通义万相',
        enabled: true,
        configured: true,
        health: 'unknown',
      },
      {
        alias: 'cogview',
        modelId: 'cogview-image-model',
        capabilities: ['image'],
        displayName: '智谱 CogView',
        enabled: true,
        configured: true,
        health: 'unknown',
      },
    ])
  })

  it('exposes a stable public alias without querying health in a Mock-only environment', async () => {
    const controller = new ModelsController(
      new ChatAdapterRegistry([adapter('mock')]),
      providerHealth,
      new ImageAdapterRegistry([imageAdapter('mock')]),
    )

    await expect(controller.list()).resolves.toEqual([
      {
        alias: 'qwen',
        modelId: 'mock-chat',
        capabilities: ['chat', 'prompt'],
        displayName: '通义千问（Mock）',
        enabled: true,
        configured: false,
        health: 'unknown',
      },
      {
        alias: 'wanxiang',
        modelId: 'mock-image',
        capabilities: ['image'],
        displayName: '通义万相（Mock）',
        enabled: true,
        configured: false,
        health: 'unknown',
      },
    ])
    expect(providerHealth.getStatus).not.toHaveBeenCalledWith('mock')
  })
})
