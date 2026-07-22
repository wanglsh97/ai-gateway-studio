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
