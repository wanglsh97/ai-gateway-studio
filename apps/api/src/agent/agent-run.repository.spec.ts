import type { PrismaService } from '../database/prisma.service'
import { AgentRunRepository } from './agent-run.repository'

function setup() {
  const create = jest.fn()
  const findFirst = jest.fn()
  const count = jest.fn()
  const update = jest.fn()
  const prisma = {
    agentRun: { create, findFirst, count, update },
  } as unknown as PrismaService
  return { create, findFirst, count, update, repository: new AgentRunRepository(prisma) }
}

describe('AgentRunRepository', () => {
  it('scopes run lookups by owner userId', async () => {
    const { findFirst, repository } = setup()
    findFirst.mockResolvedValue(null)

    await expect(repository.findForOwner('run-of-a', 'user-b')).resolves.toBeNull()
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'run-of-a', userId: 'user-b' } })
  })

  it('finds the active run for a user across all their threads', async () => {
    const { findFirst, repository } = setup()
    findFirst.mockResolvedValue({ id: 'run-1' })

    await repository.findActiveForUser('user-a')

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-a', status: { in: ['RUNNING', 'CANCELLING'] } },
      }),
    )
  })

  it('counts only active runs per user for the single-run constraint', async () => {
    const { count, repository } = setup()
    count.mockResolvedValue(1)

    await expect(repository.countActiveForUser('user-a')).resolves.toBe(1)
    expect(count).toHaveBeenCalledWith({
      where: { userId: 'user-a', status: { in: ['RUNNING', 'CANCELLING'] } },
    })
  })
})
