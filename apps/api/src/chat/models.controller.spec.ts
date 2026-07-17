import type { ChatAdapter } from './adapters/chat-adapter'
import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { ModelsController } from './models.controller'

function adapter(id: ChatAdapter['id']): ChatAdapter {
  return {
    id,
    resolvedModel: `${id}-model`,
    stream: jest.fn(),
  }
}

describe('ModelsController', () => {
  it('returns only enabled public aliases without resolved model IDs or provider details', () => {
    const controller = new ModelsController(
      new ChatAdapterRegistry([adapter('mock'), adapter('qwen'), adapter('deepseek')]),
    )

    expect(controller.list()).toEqual([
      {
        alias: 'qwen',
        capabilities: ['chat', 'prompt'],
        displayName: '通义千问',
        enabled: true,
        configured: true,
        health: 'unknown',
      },
      {
        alias: 'deepseek',
        capabilities: ['chat', 'prompt'],
        displayName: 'DeepSeek',
        enabled: true,
        configured: true,
        health: 'unknown',
      },
    ])
  })

  it('does not expose the internal Mock adapter as a public model alias', () => {
    const controller = new ModelsController(new ChatAdapterRegistry([adapter('mock')]))

    expect(controller.list()).toEqual([])
  })
})
