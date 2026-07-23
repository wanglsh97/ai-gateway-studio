import type { PrismaService } from '../../database/prisma.service'
import { AgentSkillRepository } from './agent-skill.repository'

describe('AgentSkillRepository', () => {
  it('scopes reads and mutations to the authenticated user', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 })
    const upsert = jest.fn().mockResolvedValue({ skillId: 'research' })
    const prisma = {
      userAgentSkill: { findMany, deleteMany, upsert },
    } as unknown as PrismaService
    const repository = new AgentSkillRepository(prisma)

    await repository.listForUser('user-a')
    await repository.install('user-a', 'research')
    await repository.uninstall('user-a', 'research')

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a' } }))
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_skillId: { userId: 'user-a', skillId: 'research' } },
      }),
    )
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-a', skillId: 'research' } })
  })
})
