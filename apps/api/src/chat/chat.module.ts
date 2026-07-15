import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { RequestLifecycleModule } from '../request-lifecycle/request-lifecycle.module'
import { RateLimitModule } from '../rate-limit/rate-limit.module'
import type { ChatAdapter } from './adapters/chat-adapter'
import { CHAT_ADAPTERS, ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { DeepSeekChatAdapter } from './adapters/deepseek-chat-adapter'
import { GlmChatAdapter } from './adapters/glm-chat-adapter'
import {
  DEFAULT_MOCK_CHAT_ADAPTER_OPTIONS,
  MOCK_CHAT_ADAPTER_OPTIONS,
  MockChatAdapter,
} from './adapters/mock-chat-adapter'
import { QwenChatAdapter } from './adapters/qwen-chat-adapter'
import { ChatController } from './chat.controller'
import { OpenAICompatibleChatTransport } from './transports/openai-compatible-chat.transport'

@Module({
  imports: [ConfigModule, RequestLifecycleModule, RateLimitModule],
  providers: [
    {
      provide: MOCK_CHAT_ADAPTER_OPTIONS,
      useValue: DEFAULT_MOCK_CHAT_ADAPTER_OPTIONS,
    },
    MockChatAdapter,
    OpenAICompatibleChatTransport,
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
              modelId: config.getOrThrow<string>('QWEN_MODEL_ID'),
            }),
          )
        }
        if (config.get<boolean>('GLM_ENABLED')) {
          adapters.push(
            new GlmChatAdapter(transport, {
              apiKey: config.getOrThrow<string>('GLM_API_KEY'),
              baseUrl: config.getOrThrow<string>('GLM_BASE_URL'),
              modelId: config.getOrThrow<string>('GLM_MODEL_ID'),
            }),
          )
        }
        if (config.get<boolean>('DEEPSEEK_ENABLED')) {
          adapters.push(
            new DeepSeekChatAdapter(transport, {
              apiKey: config.getOrThrow<string>('DEEPSEEK_API_KEY'),
              baseUrl: config.getOrThrow<string>('DEEPSEEK_BASE_URL'),
              modelId: config.getOrThrow<string>('DEEPSEEK_MODEL_ID'),
            }),
          )
        }
        return Object.freeze(adapters)
      },
    },
    ChatAdapterRegistry,
  ],
  controllers: [ChatController],
  exports: [ChatAdapterRegistry],
})
export class ChatModule {}
