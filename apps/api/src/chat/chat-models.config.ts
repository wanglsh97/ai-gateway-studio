import type { TextModelAlias } from '@aigateway/sdk'

export interface ChatModelConfig {
  id: string
  displayName: string
  provider: TextModelAlias
  upstreamModelId: string
}

/**
 * Chat 模型目录的唯一真源。
 *
 * 新增或调整模型必须修改此文件，并随代码评审和发布生效；运行时环境变量不能覆盖目录。
 */
export const CHAT_MODELS = Object.freeze([
  {
    id: 'qwen3.7-plus',
    displayName: 'Qwen3.7-Plus',
    provider: 'qwen',
    upstreamModelId: 'qwen3.7-plus',
  },
  {
    id: 'glm-5.2',
    displayName: 'GLM-5.2',
    provider: 'glm',
    upstreamModelId: 'glm-5.2',
  },
  {
    id: 'deepseek-v4-pro',
    displayName: 'DeepSeek-V4-Pro',
    provider: 'deepseek',
    upstreamModelId: 'deepseek-v4-pro',
  },
  {
    id: 'kimi-k3',
    displayName: 'Kimi K3',
    provider: 'kimi',
    upstreamModelId: 'kimi-k3',
  },
] satisfies readonly ChatModelConfig[])

validateChatModels(CHAT_MODELS)

export function validateChatModels(models: readonly ChatModelConfig[]): void {
  if (models.length === 0) throw new Error('Chat 模型目录不能为空')

  const ids = new Set<string>()
  const providers = new Set<TextModelAlias>()
  for (const model of models) {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(model.id)) {
      throw new Error(`Chat 模型 ID 不合法：${model.id}`)
    }
    if (ids.has(model.id)) throw new Error(`Chat 模型 ID 重复：${model.id}`)
    ids.add(model.id)
    providers.add(model.provider)
  }

  for (const provider of ['qwen', 'glm', 'deepseek', 'kimi'] as const) {
    if (!providers.has(provider)) throw new Error(`Chat 模型目录缺少厂商：${provider}`)
  }
}

export function defaultUpstreamModelId(provider: TextModelAlias): string {
  const model = CHAT_MODELS.find((candidate) => candidate.provider === provider)
  if (!model) throw new Error(`Chat 模型目录缺少厂商：${provider}`)
  return model.upstreamModelId
}
