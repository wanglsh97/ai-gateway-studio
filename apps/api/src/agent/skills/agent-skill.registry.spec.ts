import type { AgentSkillDescriptor } from './agent-skill.registry'
import { validateSkills } from './platform-agent-skill.catalog'

const validSkill: AgentSkillDescriptor = {
  id: 'research',
  name: 'Research',
  version: '1.0.0',
  description: 'Research carefully.',
  category: 'Research',
  instructions: 'Verify sources before drawing conclusions.',
  allowedTools: ['web_fetch'],
}

describe('PlatformAgentSkillCatalog validation', () => {
  it('returns a deterministic immutable catalog', () => {
    const result = validateSkills(
      [
        { ...validSkill, id: 'z-last' },
        { ...validSkill, id: 'a-first' },
      ],
      new Set(['web_fetch']),
    )
    expect(result.map((skill) => skill.id)).toEqual(['a-first', 'z-last'])
    expect(Object.isFrozen(result)).toBe(true)
  })

  it.each([
    [[validSkill, validSkill], 'Duplicate Agent Skill id'],
    [[{ ...validSkill, id: '../unsafe' }], 'Invalid Agent Skill id'],
    [[{ ...validSkill, version: 'latest' }], 'Invalid Agent Skill version'],
    [[{ ...validSkill, instructions: 'x'.repeat(4_001) }], 'Invalid Agent Skill instructions'],
    [[{ ...validSkill, allowedTools: ['shell'] }], 'references unknown tool'],
  ])('rejects unsafe descriptors', (input, message) => {
    expect(() => validateSkills(input as AgentSkillDescriptor[], new Set(['web_fetch']))).toThrow(
      message as string,
    )
  })
})
