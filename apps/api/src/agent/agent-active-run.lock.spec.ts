import { ConflictException, HttpException, HttpStatus } from '@nestjs/common'

import type { RedisService } from '../redis/redis.service'
import { AGENT_ACTIVE_RUN_LOCK_TTL_SECONDS, agentActiveRunLockKey } from './agent.constants'
import { AgentActiveRunLock } from './agent-active-run.lock'

describe('AgentActiveRunLock', () => {
  it('acquires with SET NX EX and releases only matching tokens', async () => {
    const trySetNxEx = jest.fn().mockResolvedValue(true)
    const deleteIfValueEquals = jest.fn().mockResolvedValue(true)
    const lock = new AgentActiveRunLock({
      trySetNxEx,
      deleteIfValueEquals,
    } as unknown as RedisService)

    await expect(lock.tryAcquire('user-a', 'token-1')).resolves.toBe(true)
    expect(trySetNxEx).toHaveBeenCalledWith(
      agentActiveRunLockKey('user-a'),
      'token-1',
      AGENT_ACTIVE_RUN_LOCK_TTL_SECONDS,
    )

    await lock.release('user-a', 'token-1')
    expect(deleteIfValueEquals).toHaveBeenCalledWith(agentActiveRunLockKey('user-a'), 'token-1')
  })

  it('reports contention when the key already exists', async () => {
    const lock = new AgentActiveRunLock({
      trySetNxEx: jest.fn().mockResolvedValue(false),
    } as unknown as RedisService)

    await expect(lock.tryAcquire('user-a', 'token-2')).resolves.toBe(false)
  })

  it('fails closed with 503 when Redis is unavailable on acquire', async () => {
    const lock = new AgentActiveRunLock({
      trySetNxEx: jest.fn().mockRejectedValue(new Error('redis down')),
    } as unknown as RedisService)

    await expect(lock.tryAcquire('user-a', 'token-3')).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    })
    await expect(lock.tryAcquire('user-a', 'token-3')).rejects.toBeInstanceOf(HttpException)
  })

  it('scopes lock keys per user so concurrent users do not contend', async () => {
    const trySetNxEx = jest.fn().mockResolvedValue(true)
    const lock = new AgentActiveRunLock({ trySetNxEx } as unknown as RedisService)
    await lock.tryAcquire('user-a', 't1')
    await lock.tryAcquire('user-b', 't2')
    expect(trySetNxEx).toHaveBeenNthCalledWith(1, agentActiveRunLockKey('user-a'), 't1', expect.any(Number))
    expect(trySetNxEx).toHaveBeenNthCalledWith(2, agentActiveRunLockKey('user-b'), 't2', expect.any(Number))
  })

  it('builds a conflict that identifies the existing active run', () => {
    const lock = new AgentActiveRunLock({} as RedisService)
    const error = lock.conflict('run-existing')
    expect(error).toBeInstanceOf(ConflictException)
    expect(error.getResponse()).toEqual(
      expect.objectContaining({
        message: '已有进行中的 Agent 运行，请等待其结束',
        details: { code: 'AGENT_ACTIVE_RUN', activeRunId: 'run-existing' },
      }),
    )
  })
})
