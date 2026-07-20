import type { AgentRunSummary, AgentThread, AgentThreadSummary } from '@aigateway/sdk'
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../user-auth/user-session.service'
import { ChatModelCatalog } from '../chat/chat-model-catalog'
import { AGENT_DEFAULT_THREAD_TITLE, AGENT_DERIVED_TITLE_MAX_LENGTH } from './agent.constants'
import { AgentMessageRepository } from './agent-message.repository'
import { AgentRunRepository } from './agent-run.repository'
import { AgentRunService } from './agent-run.service'
import { AgentThreadRepository } from './agent-thread.repository'
import { toMessage, toRunSummary, toThreadSummary } from './agent.mappers'
import type { AgentRun } from '../generated/prisma/client'

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name)

  constructor(
    @Inject(AgentThreadRepository) private readonly threads: AgentThreadRepository,
    @Inject(AgentRunRepository) private readonly runs: AgentRunRepository,
    @Inject(AgentMessageRepository) private readonly messages: AgentMessageRepository,
    @Inject(ChatModelCatalog) private readonly models: ChatModelCatalog,
    @Inject(AgentRunService) private readonly runService: AgentRunService,
  ) {}

  async createThread(
    user: AuthenticatedUser,
    input: { model: string; title?: string },
  ): Promise<AgentThreadSummary> {
    const model = this.models.resolve(input.model)
    if (!model) throw new BadRequestException(`未知或未启用的 Agent 模型 "${input.model}"`)

    const row = await this.threads.create({
      userId: user.id,
      title: input.title?.trim() || AGENT_DEFAULT_THREAD_TITLE,
      modelId: model.id,
      provider: model.provider,
    })
    return toThreadSummary(row)
  }

  async listThreads(user: AuthenticatedUser): Promise<AgentThreadSummary[]> {
    const rows = await this.threads.listForOwner(user.id)
    return rows.map(toThreadSummary)
  }

  async getThread(user: AuthenticatedUser, threadId: string): Promise<AgentThread> {
    const summary = await this.threads.findSummaryForOwner(threadId, user.id)
    if (!summary) throw new NotFoundException('Agent 会话不存在')

    const [messages, activeRun] = await Promise.all([
      this.messages.listForThread(threadId),
      this.runs.findActiveForThread(threadId),
    ])

    return {
      ...toThreadSummary(summary),
      messages: messages.map(toMessage),
      activeRun: activeRun ? toRunSummary(activeRun) : null,
    }
  }

  async renameThread(
    user: AuthenticatedUser,
    threadId: string,
    title: string,
  ): Promise<AgentThreadSummary> {
    const updated = await this.threads.renameForOwner(threadId, user.id, title.trim())
    if (!updated) throw new NotFoundException('Agent 会话不存在')
    const summary = await this.threads.findSummaryForOwner(threadId, user.id)
    if (!summary) throw new NotFoundException('Agent 会话不存在')
    return toThreadSummary(summary)
  }

  async deleteThread(user: AuthenticatedUser, threadId: string): Promise<void> {
    const summary = await this.threads.findSummaryForOwner(threadId, user.id)
    if (!summary) throw new NotFoundException('Agent 会话不存在')

    const activeRun = await this.runs.findActiveForThread(threadId)
    if (activeRun) throw new ConflictException('该会话存在进行中的运行，无法删除')

    const deleted = await this.threads.deleteForOwner(threadId, user.id)
    if (!deleted) throw new NotFoundException('Agent 会话不存在')
  }

  async createRun(
    user: AuthenticatedUser,
    threadId: string,
    input: string,
  ): Promise<AgentRunSummary> {
    const thread = await this.threads.findSummaryForOwner(threadId, user.id)
    if (!thread) throw new NotFoundException('Agent 会话不存在')

    const model = this.models.resolve(thread.modelId)
    if (!model) {
      throw new BadRequestException(`会话绑定的模型 "${thread.modelId}" 当前不可用`)
    }

    // 单用户全局至多一个 active run（板块 2.5 将补充 Redis 原子锁与 fail-closed）。
    const activeCount = await this.runs.countActiveForUser(user.id)
    if (activeCount > 0) throw new ConflictException('已有进行中的 Agent 运行，请等待其结束')

    const run = await this.runs.create({ threadId, userId: user.id, input })
    await this.messages.appendUserMessage(threadId, run.id, input)
    if (thread.title === AGENT_DEFAULT_THREAD_TITLE) {
      await this.threads.renameForOwner(threadId, user.id, deriveTitle(input))
    }

    void this.runService
      .execute({
        runId: run.id,
        threadId,
        userId: user.id,
        modelId: model.id,
        provider: model.provider,
        input,
      })
      .catch((error) => this.logger.error({ error, runId: run.id }, 'Agent run execution failed'))

    return toRunSummary(run)
  }

  async assertRunOwner(user: AuthenticatedUser, runId: string): Promise<AgentRun> {
    const run = await this.runs.findForOwner(runId, user.id)
    if (!run) throw new NotFoundException('Agent 运行不存在')
    return run
  }

  async cancelRun(user: AuthenticatedUser, runId: string): Promise<AgentRunSummary> {
    const run = await this.assertRunOwner(user, runId)
    this.runService.cancel(runId)
    return toRunSummary(run)
  }
}

function deriveTitle(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim()
  if (normalized.length <= AGENT_DERIVED_TITLE_MAX_LENGTH) return normalized || AGENT_DEFAULT_THREAD_TITLE
  return `${normalized.slice(0, AGENT_DERIVED_TITLE_MAX_LENGTH)}…`
}
