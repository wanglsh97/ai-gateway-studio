import type { ModelSummary, TextModelAlias } from '@aigateway/sdk'
import { Controller, Get } from '@nestjs/common'

import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { ProviderHealthService } from './provider-health.service'

const MODEL_DISPLAY_NAMES: Readonly<Record<TextModelAlias, string>> = {
  qwen: '通义千问',
  glm: '智谱 GLM',
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
}

@Controller('models')
export class ModelsController {
  constructor(
    private readonly adapters: ChatAdapterRegistry,
    private readonly providerHealth: ProviderHealthService,
  ) {}

  @Get()
  async list(): Promise<ModelSummary[]> {
    const adapters = this.adapters.list().filter((adapter) => adapter.id !== 'mock')

    if (adapters.length === 0 && this.adapters.has('mock')) {
      return [
        {
          alias: 'qwen',
          capabilities: ['chat', 'prompt'],
          displayName: '通义千问（Mock）',
          enabled: true,
          configured: false,
          health: 'unknown',
        },
      ]
    }

    return Promise.all(
      adapters.map(async (adapter) => ({
        alias: adapter.id as TextModelAlias,
        capabilities: ['chat', 'prompt'],
        displayName: MODEL_DISPLAY_NAMES[adapter.id as TextModelAlias],
        enabled: true,
        configured: true,
        health: await this.providerHealth.getStatus(adapter.id),
      })),
    )
  }
}
