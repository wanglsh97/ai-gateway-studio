import type { TextModelAlias } from '@aigateway/sdk'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'

export interface ChatModelDefinition {
  id: string
  displayName: string
  provider: TextModelAlias
  upstreamModelId: string
}

@Injectable()
export class ChatModelCatalog {
  private readonly definitions: readonly ChatModelDefinition[]

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(ChatAdapterRegistry) private readonly adapters: ChatAdapterRegistry,
  ) {
    this.definitions = Object.freeze(loadDefinitions(config, adapters))
  }

  list(): readonly ChatModelDefinition[] {
    return this.definitions.filter(
      ({ provider }) => this.adapters.has(provider) || this.adapters.has('mock'),
    )
  }

  resolve(id: string): ChatModelDefinition | undefined {
    return this.list().find((definition) => definition.id === id)
  }
}

function loadDefinitions(
  config: ConfigService,
  adapters: ChatAdapterRegistry,
): ChatModelDefinition[] {
  const configured = config.get<string>('CHAT_MODELS')
  if (configured) return JSON.parse(configured) as ChatModelDefinition[]

  const realAdapters = adapters.list().filter((adapter) => adapter.id !== 'mock')
  if (realAdapters.length > 0) {
    return realAdapters.map((adapter) => ({
      id: adapter.id,
      displayName: communityModelName(adapter.resolvedModel),
      provider: adapter.id as TextModelAlias,
      upstreamModelId: adapter.resolvedModel,
    }))
  }

  return adapters.has('mock')
    ? [
        {
          id: 'qwen',
          displayName: 'Qwen Mock',
          provider: 'qwen',
          upstreamModelId: 'mock-chat',
        },
      ]
    : []
}

export function communityModelName(modelId: string): string {
  return modelId
    .split('-')
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      if (lower === 'qwen') return 'Qwen'
      if (lower === 'glm') return 'GLM'
      if (lower === 'kimi') return 'Kimi'
      if (lower === 'deepseek') return 'DeepSeek'
      if (/^\d+(?:\.\d+)*$/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}
