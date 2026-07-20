import { AgentStartupCleanupService } from './agent-startup-cleanup.service'
import type { AgentRunRepository } from './agent-run.repository'
import type { RedisService } from '../redis/redis.service'

describe('AgentStartupCleanupService', () => {
  it('interrupts abandoned runs and clears active-run Redis locks without replaying work', async () => {
    const interruptAbandonedRuns = jest.fn().mockResolvedValue({
      count: 2,
      runIds: ['run-1', 'run-2'],
    })
    const deleteKeysByPrefix = jest.fn().mockResolvedValue(2)
    const service = new AgentStartupCleanupService(
      { interruptAbandonedRuns } as unknown as AgentRunRepository,
      { deleteKeysByPrefix } as unknown as RedisService,
    )

    await service.onModuleInit()

    expect(interruptAbandonedRuns).toHaveBeenCalledTimes(1)
    expect(deleteKeysByPrefix).toHaveBeenCalledWith('agent:active-run:')
  })

  it('logs and swallows cleanup failures so API startup continues', async () => {
    const service = new AgentStartupCleanupService(
      {
        interruptAbandonedRuns: jest.fn().mockRejectedValue(new Error('db down')),
      } as unknown as AgentRunRepository,
      { deleteKeysByPrefix: jest.fn() } as unknown as RedisService,
    )

    await expect(service.onModuleInit()).resolves.toBeUndefined()
  })
})
