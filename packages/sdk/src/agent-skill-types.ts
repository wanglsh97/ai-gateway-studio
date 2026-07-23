export const AGENT_SKILL_PUBLICATION_STATUSES = [
  'pending_review',
  'published',
  'rejected',
  'delisted',
] as const
export type AgentSkillPublicationStatus = (typeof AGENT_SKILL_PUBLICATION_STATUSES)[number]

export const AGENT_SKILL_ADD_STATES = ['not_added', 'added', 'unavailable'] as const
export type AgentSkillAddState = (typeof AGENT_SKILL_ADD_STATES)[number]

export interface AgentSkillFileEntry {
  path: string
  type: 'file' | 'directory'
  size: number | null
}

/**
 * 公开市场与“我的 Skill”共用的摘要。
 *
 * `addState=unavailable` 仅会出现在当前用户曾添加、但 Skill 已下架或缺失的私有列表中；
 * 公开市场只返回 `published` 项。
 */
export interface AgentSkillMarketSummary {
  id: string
  /** 全局唯一、供 `activate_skill` 和 Run 手动选择使用的稳定名称。 */
  name: string
  title: string
  description: string
  category: string
  publicationStatus: AgentSkillPublicationStatus
  addState: AgentSkillAddState
  addCount: number
  ownedByCurrentUser: boolean
  updatedAt: string
}

export interface AgentSkillMarketDetail extends AgentSkillMarketSummary {
  /** 已消毒的 SKILL.md 渲染源；不得包含 OSS 签名地址。 */
  skillMarkdown: string
  /** 只包含路径、类型和大小，不返回脚本正文或原始 ZIP。 */
  files: AgentSkillFileEntry[]
}

export interface SelectAgentSkill {
  /** 对应 `AgentSkillMarketSummary.name`。 */
  name: string
}

/**
 * @deprecated 现有内置 Skill API 的过渡契约；上传式市场迁移完成后使用
 * `AgentSkillMarketSummary` / `AgentSkillMarketDetail`。
 */
export interface AgentSkillMarketItem {
  id: string
  name: string
  version: string
  description: string
  category: string
  allowedTools: readonly string[]
  installed: boolean
  enabled: boolean
}

export interface UpdateAgentSkillRequest {
  enabled: boolean
}
