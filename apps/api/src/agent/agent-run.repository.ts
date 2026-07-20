import { Inject, Injectable } from '@nestjs/common'

import type { AgentRun, AgentRunStatus, Prisma } from '../generated/prisma/client'
import { PrismaService } from '../database/prisma.service'

export interface CreateAgentRunInput {
  threadId: string
  userId: string
  input: string
}

/** 未终结（进行中）的 run 状态。 */
export const ACTIVE_AGENT_RUN_STATUSES = ['RUNNING', 'CANCELLING'] as const satisfies readonly AgentRunStatus[]

/**
 * AgentRun 持久化端口。
 *
 * 与 AgentThread 一致，所有读取与变更以 `userId` 过滤；run 关联的 thread 必须同属该用户。
 */
@Injectable()
export class AgentRunRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    return this.prisma.agentRun.create({
      data: {
        threadId: input.threadId,
        userId: input.userId,
        input: input.input,
      },
    })
  }

  async findForOwner(runId: string, userId: string): Promise<AgentRun | null> {
    return this.prisma.agentRun.findFirst({ where: { id: runId, userId } })
  }

  async findActiveForUser(userId: string): Promise<AgentRun | null> {
    return this.prisma.agentRun.findFirst({
      where: { userId, status: { in: [...ACTIVE_AGENT_RUN_STATUSES] } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async countActiveForUser(userId: string): Promise<number> {
    return this.prisma.agentRun.count({
      where: { userId, status: { in: [...ACTIVE_AGENT_RUN_STATUSES] } },
    })
  }

  async updateStatus(
    runId: string,
    data: Prisma.AgentRunUpdateInput,
  ): Promise<void> {
    await this.prisma.agentRun.update({ where: { id: runId }, data })
  }
}
