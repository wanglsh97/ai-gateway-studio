import { Injectable } from '@nestjs/common'

export interface AgentSkillDescriptor {
  id: string
  name: string
  version: string
  description: string
  instructions: string
  allowedTools: readonly string[]
}

export interface AgentSkillRegistry {
  list(): readonly AgentSkillDescriptor[]
}

export const AGENT_SKILL_REGISTRY = Symbol('AGENT_SKILL_REGISTRY')

/** V1 不扫描磁盘或动态加载 Skill。 */
@Injectable()
export class EmptyAgentSkillRegistry implements AgentSkillRegistry {
  list(): readonly AgentSkillDescriptor[] {
    return []
  }
}
