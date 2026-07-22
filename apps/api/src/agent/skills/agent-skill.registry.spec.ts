import { EmptyAgentSkillRegistry } from './agent-skill.registry'

describe('EmptyAgentSkillRegistry', () => {
  it('returns no dynamic skills without touching external state', () => {
    expect(new EmptyAgentSkillRegistry().list()).toEqual([])
  })
})
