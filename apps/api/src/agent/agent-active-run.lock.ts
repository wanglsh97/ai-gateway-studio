import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common'

import { RedisService } from '../redis/redis.service'
import {
  AGENT_ACTIVE_RUN_LOCK_TTL_SECONDS,
  agentActiveRunLockKey,
} from './agent.constants'

/**
 * 单用户全局 active Agent run 的 Redis 原子锁。
 *
 * PostgreSQL 的 active run 查询仍是真源；本锁用于跨请求快速互斥。
 * Redis 不可用时 fail closed，不得绕过约束创建付费 run。
 */
@Injectable()
export class AgentActiveRunLock {
  private readonly logger = new Logger(AgentActiveRunLock.name)

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /**
   * 尝试获取用户级锁。成功返回 true；键已被占用返回 false。
   * Redis 异常抛出 503。
   */
  async tryAcquire(userId: string, token: string): Promise<boolean> {
    try {
      return await this.redis.trySetNxEx(
        agentActiveRunLockKey(userId),
        token,
        AGENT_ACTIVE_RUN_LOCK_TTL_SECONDS,
      )
    } catch (error) {
      this.logger.error({ error, userId }, 'Redis Agent active-run lock acquire failed closed')
      throw new HttpException('Agent 并发锁服务暂时不可用', HttpStatus.SERVICE_UNAVAILABLE)
    }
  }

  async release(userId: string, token: string): Promise<void> {
    try {
      await this.redis.deleteIfValueEquals(agentActiveRunLockKey(userId), token)
    } catch (error) {
      // 释放失败不阻断终态；TTL 与启动清理会回收过期锁。
      this.logger.warn({ error, userId }, 'Redis Agent active-run lock release failed')
    }
  }

  /** 锁已被占用时的统一冲突响应，可选附带已有 runId。 */
  conflict(existingRunId?: string): ConflictException {
    return new ConflictException({
      message: '已有进行中的 Agent 运行，请等待其结束',
      details: existingRunId === undefined ? { code: 'AGENT_ACTIVE_RUN' } : {
        code: 'AGENT_ACTIVE_RUN',
        activeRunId: existingRunId,
      },
    })
  }
}
