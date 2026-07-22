export interface AgentSkillDescriptor {
  id: string
  name: string
  version: string
  description: string
  category: string
  instructions: string
  allowedTools: readonly string[]
}

export interface AgentSkillRegistry {
  listForUser(userId: string): Promise<readonly AgentSkillDescriptor[]>
}

export const AGENT_SKILL_REGISTRY = Symbol('AGENT_SKILL_REGISTRY')
