import type { PrismaService } from '../database/prisma.service'
import { AgentThreadRepository } from './agent-thread.repository'

function setup() {
  const create = jest.fn()
  const findMany = jest.fn()
  const findFirst = jest.fn()
  const updateMany = jest.fn()
  const deleteMany = jest.fn()
  const prisma = {
    agentThread: { create, findMany, findFirst, updateMany, deleteMany },
  } as unknown as PrismaService
  return {
    create,
    findMany,
    findFirst,
    updateMany,
    deleteMany,
    repository: new AgentThreadRepository(prisma),
  }
}

describe('AgentThreadRepository', () => {
  it('always scopes reads by the owner userId', async () => {
    const { findFirst, findMany, repository } = setup()
    findFirst.mockResolvedValue(null)
    findMany.mockResolvedValue([])

    await repository.findSummaryForOwner('thread-1', 'user-a')
    await repository.listForOwner('user-a')

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'thread-1', userId: 'user-a' } }),
    )
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-a' }, orderBy: { updatedAt: 'desc' } }),
    )
  })

  it('returns null when a thread belongs to another user', async () => {
    const { findFirst, repository } = setup()
    findFirst.mockResolvedValue(null)

    await expect(repository.findSummaryForOwner('thread-of-a', 'user-b')).resolves.toBeNull()
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'thread-of-a', userId: 'user-b' } }),
    )
  })

  it('reports a miss when rename/delete does not match the owner scope', async () => {
    const { updateMany, deleteMany, repository } = setup()
    updateMany.mockResolvedValue({ count: 0 })
    deleteMany.mockResolvedValue({ count: 0 })

    await expect(repository.renameForOwner('thread-of-a', 'user-b', '新标题')).resolves.toBe(false)
    await expect(repository.deleteForOwner('thread-of-a', 'user-b')).resolves.toBe(false)
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'thread-of-a', userId: 'user-b' },
      data: { title: '新标题' },
    })
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'thread-of-a', userId: 'user-b' } })
  })

  it('confirms owner-scoped rename/delete hits', async () => {
    const { updateMany, deleteMany, repository } = setup()
    updateMany.mockResolvedValue({ count: 1 })
    deleteMany.mockResolvedValue({ count: 1 })

    await expect(repository.renameForOwner('thread-1', 'user-a', 'x')).resolves.toBe(true)
    await expect(repository.deleteForOwner('thread-1', 'user-a')).resolves.toBe(true)
  })
})
