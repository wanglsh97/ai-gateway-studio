import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { DeepSeekChatAdapter } from './adapters/deepseek-chat-adapter'
import { GlmChatAdapter } from './adapters/glm-chat-adapter'
import { MockChatAdapter } from './adapters/mock-chat-adapter'
import { QwenChatAdapter } from './adapters/qwen-chat-adapter'
import { ChatModule } from './chat.module'

async function createRegistry(options: {
  mockEnabled: boolean
  qwenEnabled?: boolean
  glmEnabled?: boolean
  deepseekEnabled?: boolean
}) {
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
            GLM_ENABLED: options.glmEnabled ?? false,
            GLM_API_KEY: 'sanitized-test-key',
            GLM_BASE_URL: 'https://glm.example/api/paas/v4',
            GLM_MODEL_ID: 'glm-test-model',
            DEEPSEEK_ENABLED: options.deepseekEnabled ?? false,
            DEEPSEEK_API_KEY: 'sanitized-test-key',
            DEEPSEEK_BASE_URL: 'https://deepseek.example',
            DEEPSEEK_MODEL_ID: 'deepseek-test-model',
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

  it('registers the configured GLM adapter behind its feature flag', async () => {
    const { module, registry } = await createRegistry({ mockEnabled: true, glmEnabled: true })

    expect(registry.get('glm')).toBeInstanceOf(GlmChatAdapter)
    expect(registry.get('glm').resolvedModel).toBe('glm-test-model')
    await module.close()
  })

  it('registers the configured DeepSeek adapter behind its feature flag', async () => {
    const { module, registry } = await createRegistry({
      mockEnabled: true,
      deepseekEnabled: true,
    })

    expect(registry.get('deepseek')).toBeInstanceOf(DeepSeekChatAdapter)
    expect(registry.get('deepseek').resolvedModel).toBe('deepseek-test-model')
    await module.close()
  })
})
