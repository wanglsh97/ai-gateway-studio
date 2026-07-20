import type { ChatAdapter } from './adapters/chat-adapter'
import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import type { ImageAdapter } from '../image/adapters/image-adapter'
import { ImageAdapterRegistry } from '../image/adapters/image-adapter.registry'
import { ModelsController } from './models.controller'
import type { ChatModelCatalog } from './chat-model-catalog'
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
      {
        list: () => [
          {
            id: 'qwen-plus',
            provider: 'qwen',
            upstreamModelId: 'qwen-plus',
            displayName: 'Qwen Plus',
          },
          {
            id: 'deepseek-v4',
            provider: 'deepseek',
            upstreamModelId: 'deepseek-v4',
            displayName: 'DeepSeek V4',
          },
        ],
      } as unknown as ChatModelCatalog,
      providerHealth,
      new ImageAdapterRegistry([imageAdapter('wanxiang'), imageAdapter('cogview')]),
    )

    await expect(controller.list()).resolves.toEqual([
      {
        id: 'qwen-plus',
        alias: 'qwen',
        modelId: 'qwen-plus',
        capabilities: ['chat', 'prompt'],
        displayName: 'Qwen Plus',
        enabled: true,
        configured: true,
        health: 'healthy',
      },
      {
        id: 'deepseek-v4',
        alias: 'deepseek',
        modelId: 'deepseek-v4',
        capabilities: ['chat', 'prompt'],
        displayName: 'DeepSeek V4',
        enabled: true,
        configured: true,
        health: 'unhealthy',
      },
      {
        id: 'wanxiang',
        alias: 'wanxiang',
        modelId: 'wanxiang-image-model',
        capabilities: ['image'],
        displayName: '通义万相',
        enabled: true,
        configured: true,
        health: 'unknown',
      },
      {
        id: 'cogview',
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
      {
        list: () => [
          { id: 'qwen', provider: 'qwen', upstreamModelId: 'mock-chat', displayName: 'Qwen Mock' },
        ],
      } as unknown as ChatModelCatalog,
      providerHealth,
      new ImageAdapterRegistry([imageAdapter('mock')]),
    )

    await expect(controller.list()).resolves.toEqual([
      {
        id: 'qwen',
        alias: 'qwen',
        modelId: 'mock-chat',
        capabilities: ['chat', 'prompt'],
        displayName: 'Qwen Mock',
        enabled: true,
        configured: false,
        health: 'unknown',
      },
      {
        id: 'wanxiang',
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
