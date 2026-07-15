import { Module } from '@nestjs/common'

import { CHAT_ADAPTERS, ChatAdapterRegistry } from './adapters/chat-adapter.registry'

@Module({
  providers: [
    {
      provide: CHAT_ADAPTERS,
      useValue: Object.freeze([]),
    },
    ChatAdapterRegistry,
  ],
  exports: [ChatAdapterRegistry],
})
export class ChatModule {}
