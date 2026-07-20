import type { TextModelAlias } from '@aigateway/sdk'
import { Inject, Injectable } from '@nestjs/common'

import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { CHAT_MODELS } from './chat-models.config'

export interface ChatModelDefinition {
  id: string
  displayName: string
  provider: TextModelAlias
  upstreamModelId: string
}

@Injectable()
export class ChatModelCatalog {
  constructor(@Inject(ChatAdapterRegistry) private readonly adapters: ChatAdapterRegistry) {}

  list(): readonly ChatModelDefinition[] {
    return CHAT_MODELS.filter(
      ({ provider }) => this.adapters.has(provider) || this.adapters.has('mock'),
    )
  }

  resolve(id: string): ChatModelDefinition | undefined {
    return this.list().find((definition) => definition.id === id)
  }
}
