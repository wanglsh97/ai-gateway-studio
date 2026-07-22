import { Inject, Injectable } from '@nestjs/common'

import { AgentToolRegistry } from '../tools/agent-tool.registry'
import type { AgentSkillDescriptor } from './agent-skill.registry'

const SKILL_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/

export const PLATFORM_AGENT_SKILLS: readonly AgentSkillDescriptor[] = Object.freeze([
  {
    id: 'deep-research',
    name: '深度研究',
    version: '1.0.0',
    description: '拆解复杂问题，核对来源并形成结构化研究结论。',
    category: '研究',
    instructions:
      'For research tasks, clarify the question, break it into verifiable subquestions, use available sources when recency or attribution matters, compare evidence, identify uncertainty, and finish with a concise structured synthesis and clickable sources.',
    allowedTools: ['web_fetch'],
  },
  {
    id: 'code-explainer',
    name: '代码解释',
    version: '1.0.0',
    description: '阅读代码上下文，清晰说明逻辑、依赖、数据流与风险。',
    category: '开发',
    instructions:
      'When explaining code, begin with its observable purpose, trace the important control and data flow, name relevant contracts and side effects, distinguish confirmed behavior from inference, and call out concrete risks without inventing missing context.',
    allowedTools: [],
  },
  {
    id: 'content-polish',
    name: '内容润色',
    version: '1.0.0',
    description: '改善表达、语气和结构，同时保留原始事实与意图。',
    category: '写作',
    instructions:
      'For editing tasks, preserve the author’s facts, intent, language, and required terminology. Improve clarity, structure, tone, and concision; do not silently add claims, citations, or commitments that were absent from the source.',
    allowedTools: [],
  },
])

@Injectable()
export class PlatformAgentSkillCatalog {
  private readonly skills: readonly AgentSkillDescriptor[]
  private readonly byId: ReadonlyMap<string, AgentSkillDescriptor>

  constructor(@Inject(AgentToolRegistry) tools: AgentToolRegistry) {
    this.skills = validateSkills(
      PLATFORM_AGENT_SKILLS,
      new Set(tools.list().map((tool) => tool.name)),
    )
    this.byId = new Map(this.skills.map((skill) => [skill.id, skill]))
  }

  list(): readonly AgentSkillDescriptor[] {
    return this.skills
  }

  find(skillId: string): AgentSkillDescriptor | undefined {
    return this.byId.get(skillId)
  }
}

export function validateSkills(
  input: readonly AgentSkillDescriptor[],
  registeredTools: ReadonlySet<string>,
): readonly AgentSkillDescriptor[] {
  const seen = new Set<string>()
  const validated = input.map((skill) => {
    if (!SKILL_ID.test(skill.id) || skill.id.length > 64)
      throw new Error(`Invalid Agent Skill id: ${skill.id}`)
    if (seen.has(skill.id)) throw new Error(`Duplicate Agent Skill id: ${skill.id}`)
    seen.add(skill.id)
    if (!SEMVER.test(skill.version) || skill.version.length > 32) {
      throw new Error(`Invalid Agent Skill version: ${skill.id}@${skill.version}`)
    }
    assertText(skill.id, 'name', skill.name, 80)
    assertText(skill.id, 'description', skill.description, 400)
    assertText(skill.id, 'category', skill.category, 40)
    assertText(skill.id, 'instructions', skill.instructions, 4_000)
    if (new Set(skill.allowedTools).size !== skill.allowedTools.length) {
      throw new Error(`Agent Skill ${skill.id} declares duplicate tools`)
    }
    for (const tool of skill.allowedTools) {
      if (!registeredTools.has(tool))
        throw new Error(`Agent Skill ${skill.id} references unknown tool: ${tool}`)
    }
    return Object.freeze({ ...skill, allowedTools: Object.freeze([...skill.allowedTools].sort()) })
  })
  return Object.freeze(validated.sort((left, right) => left.id.localeCompare(right.id)))
}

function assertText(skillId: string, field: string, value: string, max: number): void {
  if (value.trim() !== value || value.length === 0 || value.length > max) {
    throw new Error(`Invalid Agent Skill ${field}: ${skillId}`)
  }
}
