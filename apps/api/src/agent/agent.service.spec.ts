import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

import type { ChatModelCatalog } from '../chat/chat-model-catalog'
import type { AuthenticatedUser } from '../user-auth/user-session.service'
import type { AgentMessageRepository } from './agent-message.repository'
import type { AgentRunRepository } from './agent-run.repository'
import type { AgentRunService } from './agent-run.service'
import type { AgentThreadRepository } from './agent-thread.repository'
import { AgentService } from './agent.service'

const user: AuthenticatedUser = {
  id: 'user-a',
  githubId: '1',
  githubUsername: 'octocat',
  displayName: null,
  avatarUrl: null,
}

function setup() {
  const threads = {
    create: jest.fn(),
    listForOwner: jest.fn(),
    findSummaryForOwner: jest.fn(),
    renameForOwner: jest.fn(),
    deleteForOwner: jest.fn(),
  } as unknown as jest.Mocked<AgentThreadRepository>
  const runs = {
    create: jest.fn(),
    findForOwner: jest.fn(),
    findActiveForThread: jest.fn(),
    countActiveForUser: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<AgentRunRepository>
  const messages = {
    listForThread: jest.fn().mockResolvedValue([]),
    appendUserMessage: jest.fn(),
  } as unknown as jest.Mocked<AgentMessageRepository>
  const models = { resolve: jest.fn() } as unknown as jest.Mocked<ChatModelCatalog>
  const runService = { execute: jest.fn().mockResolvedValue(undefined), cancel: jest.fn() } as unknown as jest.Mocked<AgentRunService>
  const service = new AgentService(threads, runs, messages, models, runService)
  return { threads, runs, messages, models, runService, service }
}

function threadRow(overrides: Partial<{ id: string; title: string; modelId: string; provider: string }> = {}) {
  return {
    id: 'thread-1',
    title: '新的 Agent 会话',
    modelId: 'qwen3.7-plus',
    provider: 'qwen',
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    updatedAt: new Date('2026-07-20T00:00:00.000Z'),
    ...overrides,
  }
}

describe('AgentService', () => {
  it('rejects creating a thread with an unknown model', async () => {
    const { service, models, threads } = setup()
    ;(models.resolve as jest.Mock).mockReturnValue(undefined)
    await expect(service.createThread(user, { model: 'ghost' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(threads.create).not.toHaveBeenCalled()
  })

  it('creates a thread bound to the resolved provider', async () => {
    const { service, models, threads } = setup()
    ;(models.resolve as jest.Mock).mockReturnValue({ id: 'qwen3.7-plus', provider: 'qwen', upstreamModelId: 'x', displayName: 'Q' })
    ;(threads.create as jest.Mock).mockResolvedValue(threadRow())
    await service.createThread(user, { model: 'qwen3.7-plus' })
    expect(threads.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a', modelId: 'qwen3.7-plus', provider: 'qwen' }),
    )
  })

  it('returns 404 for a thread owned by another user', async () => {
    const { service, threads } = setup()
    ;(threads.findSummaryForOwner as jest.Mock).mockResolvedValue(null)
    await expect(service.getThread(user, 'thread-x')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('rejects a second concurrent run for the same user', async () => {
    const { service, threads, runs, models } = setup()
    ;(threads.findSummaryForOwner as jest.Mock).mockResolvedValue(threadRow())
    ;(models.resolve as jest.Mock).mockReturnValue({ id: 'qwen3.7-plus', provider: 'qwen', upstreamModelId: 'x', displayName: 'Q' })
    ;(runs.countActiveForUser as jest.Mock).mockResolvedValue(1)
    await expect(service.createRun(user, 'thread-1', '你好')).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(runs.create).not.toHaveBeenCalled()
  })

  it('creates a run, persists the user message and kicks execution', async () => {
    const { service, threads, runs, messages, runService, models } = setup()
    ;(threads.findSummaryForOwner as jest.Mock).mockResolvedValue(threadRow())
    ;(models.resolve as jest.Mock).mockReturnValue({ id: 'qwen3.7-plus', provider: 'qwen', upstreamModelId: 'x', displayName: 'Q' })
    ;(runs.create as jest.Mock).mockResolvedValue({
      id: 'run-1',
      threadId: 'thread-1',
      status: 'RUNNING',
      limitReason: null,
      usageUnknown: false,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostCny: null,
      modelCallCount: 0,
      toolCallCount: 0,
      webFetchCount: 0,
      lastSequence: -1,
      createdAt: new Date('2026-07-20T00:00:00.000Z'),
      startedAt: null,
      completedAt: null,
    })
    const summary = await service.createRun(user, 'thread-1', '总结 https://a.test')
    expect(summary.id).toBe('run-1')
    expect(summary.status).toBe('running')
    expect(messages.appendUserMessage).toHaveBeenCalledWith('thread-1', 'run-1', '总结 https://a.test')
    expect(runService.execute).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-1', threadId: 'thread-1', userId: 'user-a', modelId: 'qwen3.7-plus' }),
    )
  })

  it('refuses to delete a thread with an active run', async () => {
    const { service, threads, runs } = setup()
    ;(threads.findSummaryForOwner as jest.Mock).mockResolvedValue(threadRow())
    ;(runs.findActiveForThread as jest.Mock).mockResolvedValue({ id: 'run-1' })
    await expect(service.deleteThread(user, 'thread-1')).rejects.toBeInstanceOf(ConflictException)
    expect(threads.deleteForOwner).not.toHaveBeenCalled()
  })

  it('cancels a run only when owned by the user', async () => {
    const { service, runs, runService } = setup()
    ;(runs.findForOwner as jest.Mock).mockResolvedValue(null)
    await expect(service.cancelRun(user, 'run-x')).rejects.toBeInstanceOf(NotFoundException)
    expect(runService.cancel).not.toHaveBeenCalled()
  })
})
