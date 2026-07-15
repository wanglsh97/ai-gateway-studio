import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import type { ChatAdapter } from './adapters/chat-adapter'
import { CHAT_ADAPTERS, ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import {
  DEFAULT_MOCK_CHAT_ADAPTER_OPTIONS,
  MOCK_CHAT_ADAPTER_OPTIONS,
  MockChatAdapter,
} from './adapters/mock-chat-adapter'

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MOCK_CHAT_ADAPTER_OPTIONS,
      useValue: DEFAULT_MOCK_CHAT_ADAPTER_OPTIONS,
    },
    MockChatAdapter,
    {
      provide: CHAT_ADAPTERS,
      inject: [ConfigService, MockChatAdapter],
      useFactory: (config: ConfigService, mock: MockChatAdapter): readonly ChatAdapter[] =>
        config.getOrThrow<boolean>('MOCK_PROVIDER_ENABLED') ? Object.freeze([mock]) : [],
    },
    ChatAdapterRegistry,
  ],
  exports: [ChatAdapterRegistry],
})
export class ChatModule {}
