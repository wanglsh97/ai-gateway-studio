import { ConfigService } from '@nestjs/config'

import type { ChatAdapter } from './adapters/chat-adapter'
import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { ChatModelCatalog } from './chat-model-catalog'

function adapter(id: ChatAdapter['id'], resolvedModel: string): ChatAdapter {
  return { id, resolvedModel, stream: jest.fn() }
}

describe('ChatModelCatalog', () => {
  it('supports multiple selectable models through one provider adapter', () => {
    const catalog = new ChatModelCatalog(
      new ConfigService({
        CHAT_MODELS: JSON.stringify([
          {
            id: 'kimi-k2.6',
            displayName: 'Kimi K2.6',
            provider: 'kimi',
            upstreamModelId: 'kimi-k2.6',
          },
          {
            id: 'kimi-k3',
            displayName: 'Kimi K3',
            provider: 'kimi',
            upstreamModelId: 'kimi-k3',
          },
        ]),
      }),
      new ChatAdapterRegistry([adapter('kimi', 'legacy-kimi')]),
    )

    expect(catalog.list()).toHaveLength(2)
    expect(catalog.resolve('kimi-k3')).toEqual({
      id: 'kimi-k3',
      displayName: 'Kimi K3',
      provider: 'kimi',
      upstreamModelId: 'kimi-k3',
    })
  })

  it('derives one backward-compatible model per enabled provider without a catalog', () => {
    const catalog = new ChatModelCatalog(
      new ConfigService({}),
      new ChatAdapterRegistry([adapter('qwen', 'qwen3.7-max'), adapter('kimi', 'kimi-k2.6')]),
    )

    expect(catalog.list()).toEqual([
      {
        id: 'qwen',
        displayName: 'Qwen3.7 Max',
        provider: 'qwen',
        upstreamModelId: 'qwen3.7-max',
      },
      {
        id: 'kimi',
        displayName: 'Kimi K2.6',
        provider: 'kimi',
        upstreamModelId: 'kimi-k2.6',
      },
    ])
  })
})
