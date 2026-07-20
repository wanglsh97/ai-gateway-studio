import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { RequestLifecycleModule } from '../request-lifecycle/request-lifecycle.module'
import { PricingService } from '../billing/pricing.service'
import { ImageModule } from '../image/image.module'
import { RateLimitModule } from '../rate-limit/rate-limit.module'
import { UserAuthModule } from '../user-auth/user-auth.module'
import type { ChatAdapter } from './adapters/chat-adapter'
import { CHAT_ADAPTERS, ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { DeepSeekChatAdapter } from './adapters/deepseek-chat-adapter'
import { GlmChatAdapter } from './adapters/glm-chat-adapter'
import { KimiChatAdapter } from './adapters/kimi-chat-adapter'
import {
  DEFAULT_MOCK_CHAT_ADAPTER_OPTIONS,
  MOCK_CHAT_ADAPTER_OPTIONS,
  MockChatAdapter,
} from './adapters/mock-chat-adapter'
import { QwenChatAdapter } from './adapters/qwen-chat-adapter'
import { ChatController } from './chat.controller'
import { ChatModelCatalog } from './chat-model-catalog'
import { defaultUpstreamModelId } from './chat-models.config'
import { ChatFailoverService } from './chat-failover.service'
import { MODEL_INVOCATION_PORT } from './model-invocation.port'
import { ModelInvocationService } from './model-invocation.service'
import { ModelsController } from './models.controller'
import { ProviderHealthService } from './provider-health.service'
import { OpenAICompatibleChatTransport } from './transports/openai-compatible-chat.transport'

@Module({
  imports: [ConfigModule, RequestLifecycleModule, RateLimitModule, ImageModule, UserAuthModule],
  providers: [
    {
      provide: MOCK_CHAT_ADAPTER_OPTIONS,
      useValue: DEFAULT_MOCK_CHAT_ADAPTER_OPTIONS,
    },
    MockChatAdapter,
    {
      provide: OpenAICompatibleChatTransport,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAICompatibleChatTransport({
          timeoutMs: config.get<number>('PROVIDER_TIMEOUT_MS', 60_000),
          connections: config.get<number>('PROVIDER_MAX_CONNECTIONS', 20),
        }),
    },
    {
      provide: CHAT_ADAPTERS,
      inject: [ConfigService, MockChatAdapter, OpenAICompatibleChatTransport],
      useFactory: (
        config: ConfigService,
        mock: MockChatAdapter,
        transport: OpenAICompatibleChatTransport,
      ): readonly ChatAdapter[] => {
        const adapters: ChatAdapter[] = []
        if (config.get<boolean>('MOCK_PROVIDER_ENABLED')) adapters.push(mock)
        if (config.get<boolean>('QWEN_ENABLED')) {
          adapters.push(
            new QwenChatAdapter(transport, {
              apiKey: config.getOrThrow<string>('QWEN_API_KEY'),
              baseUrl: config.getOrThrow<string>('QWEN_BASE_URL'),
              modelId: defaultUpstreamModelId('qwen'),
            }),
          )
        }
        if (config.get<boolean>('GLM_ENABLED')) {
          adapters.push(
            new GlmChatAdapter(transport, {
              apiKey: config.getOrThrow<string>('GLM_API_KEY'),
              baseUrl: config.getOrThrow<string>('GLM_BASE_URL'),
              modelId: defaultUpstreamModelId('glm'),
            }),
          )
        }
        if (config.get<boolean>('DEEPSEEK_ENABLED')) {
          adapters.push(
            new DeepSeekChatAdapter(transport, {
              apiKey: config.getOrThrow<string>('DEEPSEEK_API_KEY'),
              baseUrl: config.getOrThrow<string>('DEEPSEEK_BASE_URL'),
              modelId: defaultUpstreamModelId('deepseek'),
            }),
          )
        }
        if (config.get<boolean>('KIMI_ENABLED')) {
          adapters.push(
            new KimiChatAdapter(transport, {
              apiKey: config.getOrThrow<string>('KIMI_API_KEY'),
              baseUrl: config.getOrThrow<string>('KIMI_BASE_URL'),
              modelId: defaultUpstreamModelId('kimi'),
            }),
          )
        }
        return Object.freeze(adapters)
      },
    },
    ChatAdapterRegistry,
    ChatModelCatalog,
    ChatFailoverService,
    ProviderHealthService,
    PricingService,
    ModelInvocationService,
    { provide: MODEL_INVOCATION_PORT, useExisting: ModelInvocationService },
  ],
  controllers: [ChatController, ModelsController],
  exports: [
    ChatAdapterRegistry,
    ChatModelCatalog,
    ProviderHealthService,
    ModelInvocationService,
    MODEL_INVOCATION_PORT,
  ],
})
export class ChatModule {}
