import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import type { AgentContextSummary } from '../../generated/prisma/client'
import { PrismaService } from '../../database/prisma.service'
import type { AgentContextSummaryV1 } from './agent-context-summary.schema'

export interface SaveAgentContextSummaryInput {
  threadId: string
  coveredThroughSequence: number
  schemaVersion: string
  promptHash: string
  modelId: string
  content: AgentContextSummaryV1
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

@Injectable()
export class AgentContextSummaryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findForThread(threadId: string): Promise<AgentContextSummary | null> {
    return this.prisma.agentContextSummary.findUnique({ where: { threadId } })
  }

  /** 仅在新摘要已通过 Schema 校验后调用；单行 upsert 保证旧摘要不会先被破坏。 */
  saveValid(input: SaveAgentContextSummaryInput): Promise<AgentContextSummary> {
    const data = {
      coveredThroughSequence: input.coveredThroughSequence,
      schemaVersion: input.schemaVersion,
      promptHash: input.promptHash,
      modelId: input.modelId,
      content: input.content as unknown as Prisma.InputJsonValue,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
    }
    return this.prisma.agentContextSummary.upsert({
      where: { threadId: input.threadId },
      create: { threadId: input.threadId, revision: 1, ...data },
      update: { ...data, revision: { increment: 1 } },
    })
  }
}
