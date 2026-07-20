import type { ImageModelAlias, ModelSummary, TextModelAlias } from '@aigateway/sdk'
import { Controller, Get, Inject } from '@nestjs/common'

import { ImageAdapterRegistry } from '../image/adapters/image-adapter.registry'
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
    @Inject(ChatAdapterRegistry) private readonly adapters: ChatAdapterRegistry,
    @Inject(ProviderHealthService) private readonly providerHealth: ProviderHealthService,
    @Inject(ImageAdapterRegistry) private readonly imageAdapters: ImageAdapterRegistry,
  ) {}

  @Get()
  async list(): Promise<ModelSummary[]> {
    const adapters = this.adapters.list().filter((adapter) => adapter.id !== 'mock')

    const chatModels: ModelSummary[] =
      adapters.length === 0 && this.adapters.has('mock')
        ? [
            {
              alias: 'qwen' as const,
              modelId: 'mock-chat',
              capabilities: ['chat', 'prompt'],
              displayName: '通义千问（Mock）',
              enabled: true,
              configured: false,
              health: 'unknown',
            },
          ]
        : await Promise.all(
            adapters.map(async (adapter) => ({
              alias: adapter.id as TextModelAlias,
              modelId: adapter.resolvedModel,
              capabilities: ['chat', 'prompt'],
              displayName: MODEL_DISPLAY_NAMES[adapter.id as TextModelAlias],
              enabled: true,
              configured: true,
              health: await this.providerHealth.getStatus(adapter.id),
            })),
          )
    const imageAdapters = this.imageAdapters.list().filter((adapter) => adapter.id !== 'mock')
    const imageModels: ModelSummary[] =
      imageAdapters.length === 0 && this.imageAdapters.has('mock')
        ? [
            {
              alias: 'wanxiang',
              modelId: 'mock-image',
              capabilities: ['image'],
              displayName: '通义万相（Mock）',
              enabled: true,
              configured: false,
              health: 'unknown',
            },
          ]
        : imageAdapters.map((adapter) => ({
            alias: adapter.id as ImageModelAlias,
            modelId: adapter.resolvedModel,
            capabilities: ['image'],
            displayName: adapter.id === 'wanxiang' ? '通义万相' : '智谱 CogView',
            enabled: true,
            configured: true,
            health: 'unknown',
          }))

    return [...chatModels, ...imageModels]
  }
}
