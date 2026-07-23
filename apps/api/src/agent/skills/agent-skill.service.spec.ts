import { NotFoundException } from '@nestjs/common'

import type { AgentSkillDescriptor } from './agent-skill.registry'
import type { AgentSkillRepository, UserAgentSkillState } from './agent-skill.repository'
import { AgentSkillService } from './agent-skill.service'
import type { PlatformAgentSkillCatalog } from './platform-agent-skill.catalog'

const skill: AgentSkillDescriptor = {
  id: 'research',
  name: 'Research',
  version: '1.0.0',
  description: 'Research carefully.',
  category: 'Research',
  instructions: 'Verify sources.',
  allowedTools: ['web_fetch'],
}

describe('AgentSkillService', () => {
  it('merges registered catalog with user installation state and ignores stale rows', async () => {
    const service = createService([{ skillId: 'research' }, { skillId: 'removed-skill' }])
    await expect(service.listMarket('user-1')).resolves.toEqual([
      expect.objectContaining({ id: 'research', installed: true, enabled: true }),
    ])
    await expect(service.listForUser('user-1')).resolves.toEqual([skill])
  })

  it('loads every added registered Skill without a separate enabled state', async () => {
    const service = createService([{ skillId: 'research' }])
    await expect(service.listForUser('user-1')).resolves.toEqual([skill])
  })

  it('fails closed for an unknown Skill', async () => {
    const service = createService([])
    await expect(service.install('user-1', 'unknown')).rejects.toBeInstanceOf(NotFoundException)
  })
})

function createService(states: UserAgentSkillState[]): AgentSkillService {
  const catalog = {
    list: () => [skill],
    find: (skillId: string) => (skillId === skill.id ? skill : undefined),
  } as unknown as PlatformAgentSkillCatalog
  const repository = {
    listForUser: jest.fn(async () => states),
    install: jest.fn(async (_userId: string, skillId: string) => ({ skillId })),
    uninstall: jest.fn(),
  } as unknown as AgentSkillRepository
  return new AgentSkillService(catalog, repository)
}
