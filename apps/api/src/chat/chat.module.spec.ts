import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { MockChatAdapter } from './adapters/mock-chat-adapter'
import { QwenChatAdapter } from './adapters/qwen-chat-adapter'
import { ChatModule } from './chat.module'

async function createRegistry(options: { mockEnabled: boolean; qwenEnabled?: boolean }) {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [
          () => ({
            MOCK_PROVIDER_ENABLED: options.mockEnabled,
            QWEN_ENABLED: options.qwenEnabled ?? false,
            QWEN_API_KEY: 'sanitized-test-key',
            QWEN_BASE_URL: 'https://dashscope.example/compatible-mode/v1',
            QWEN_MODEL_ID: 'qwen-test-model',
            DATABASE_URL: 'postgresql://aigateway:password@localhost:5432/aigateway_test',
            REDIS_URL: 'redis://localhost:6379',
            CHAT_RATE_LIMIT_PER_MINUTE: 10,
          }),
        ],
      }),
      ChatModule,
    ],
  }).compile()

  return { module, registry: module.get(ChatAdapterRegistry) }
}

describe('ChatModule', () => {
  it('registers MockChatAdapter when Mock mode is enabled', async () => {
    const { module, registry } = await createRegistry({ mockEnabled: true })

    expect(registry.get('mock')).toBeInstanceOf(MockChatAdapter)
    await module.close()
  })

  it('does not register MockChatAdapter when Mock mode is disabled', async () => {
    const { module, registry } = await createRegistry({ mockEnabled: false })

    expect(registry.has('mock')).toBe(false)
    await module.close()
  })

  it('registers the configured Qwen adapter behind its feature flag', async () => {
    const { module, registry } = await createRegistry({ mockEnabled: true, qwenEnabled: true })

    expect(registry.get('qwen')).toBeInstanceOf(QwenChatAdapter)
    expect(registry.get('qwen').resolvedModel).toBe('qwen-test-model')
    await module.close()
  })
})
