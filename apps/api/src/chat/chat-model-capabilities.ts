import type { Capability, TextModelAlias } from '@aigateway/sdk'

/**
 * 已通过真实 provider Agent tool-calling contract / 最低成本 smoke 的模型 ID。
 * 在任务 4.6 通过前保持为空；空集合时仅 Mock 回退路径可声明 `agent`。
 */
export const AGENT_CONTRACT_VERIFIED_MODEL_IDS: ReadonlySet<string> = new Set()

export interface ChatCapabilityContext {
  modelId: string
  provider: TextModelAlias
  /** 该厂商真实 Adapter 是否已注册（API Key / 启用）。 */
  providerConfigured: boolean
  /** Mock Adapter 是否可用。 */
  mockAvailable: boolean
}

/**
 * 计算对外暴露的 Chat 模型 capabilities。
 *
 * `agent` 仅在「启用且可服务」且「已通过 tool-calling contract」时出现：
 * - 真实模型：必须列入 {@link AGENT_CONTRACT_VERIFIED_MODEL_IDS}，且真实或 Mock Adapter 可服务；
 * - 未验证模型：仅当真实 Adapter 未配置、由 Mock 服务时声明 `agent`（Mock 已通过统一 contract）。
 */
export function resolveChatModelCapabilities(context: ChatCapabilityContext): Capability[] {
  const capabilities: Capability[] = ['chat', 'prompt']
  if (canAdvertiseAgentCapability(context)) capabilities.push('agent')
  return capabilities
}

export function canAdvertiseAgentCapability(context: ChatCapabilityContext): boolean {
  const canServe = context.providerConfigured || context.mockAvailable
  if (!canServe) return false

  if (AGENT_CONTRACT_VERIFIED_MODEL_IDS.has(context.modelId)) return true

  // Mock 已通过 agent tool-calling contract；未验证的真实厂商不得冒充 agent。
  return context.mockAvailable && !context.providerConfigured
}
