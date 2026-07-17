import type { ModelSummary, TextModelAlias } from '@aigateway/sdk'
import { Controller, Get } from '@nestjs/common'

import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'

const MODEL_DISPLAY_NAMES: Readonly<Record<TextModelAlias, string>> = {
  qwen: '通义千问',
  glm: '智谱 GLM',
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
}

@Controller('models')
export class ModelsController {
  constructor(private readonly adapters: ChatAdapterRegistry) {}

  @Get()
  list(): ModelSummary[] {
    return this.adapters.list().flatMap((adapter) => {
      if (adapter.id === 'mock') return []

      return [
        {
          alias: adapter.id,
          capabilities: ['chat', 'prompt'],
          displayName: MODEL_DISPLAY_NAMES[adapter.id],
          enabled: true,
          configured: true,
          health: 'unknown',
        },
      ]
    })
  }
}
