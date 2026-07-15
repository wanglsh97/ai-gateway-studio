import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { MockChatAdapter } from './adapters/mock-chat-adapter'
import { ChatModule } from './chat.module'

async function createRegistry(mockEnabled: boolean) {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [
          () => ({
            MOCK_PROVIDER_ENABLED: mockEnabled,
            DATABASE_URL: 'postgresql://aigateway:password@localhost:5432/aigateway_test',
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
    const { module, registry } = await createRegistry(true)

    expect(registry.get('mock')).toBeInstanceOf(MockChatAdapter)
    await module.close()
  })

  it('does not register MockChatAdapter when Mock mode is disabled', async () => {
    const { module, registry } = await createRegistry(false)

    expect(registry.has('mock')).toBe(false)
    await module.close()
  })
})
