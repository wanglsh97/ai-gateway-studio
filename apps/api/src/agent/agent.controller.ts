import type { AgentStreamEvent } from '@aigateway/sdk'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'

import { CurrentUser } from '../user-auth/current-user.decorator'
import { USER_SESSION_COOKIE } from '../user-auth/user-auth.constants'
import type { AuthenticatedUser } from '../user-auth/user-session.service'
import { UserSessionGuard } from '../user-auth/user-session.guard'
import { AgentRunEventBus } from './agent-run-event-bus'
import { AgentRunRepository } from './agent-run.repository'
import { AgentService } from './agent.service'
import { CreateAgentRunDto } from './dto/create-agent-run.dto'
import { UpdateAgentSkillDto } from './dto/update-agent-skill.dto'
import {
  CreateAgentThreadDto,
  ListAgentThreadsQueryDto,
  UpdateAgentThreadDto,
} from './dto/agent-thread.dto'
import { AgentSkillService } from './skills/agent-skill.service'
import { ExecutableSkillService } from './skills/executable-skill.service'

@ApiTags('Agent')
@ApiCookieAuth(USER_SESSION_COOKIE)
@UseGuards(UserSessionGuard)
@Controller('agent')
export class AgentController {
  constructor(
    @Inject(AgentService) private readonly agent: AgentService,
    @Inject(AgentRunRepository) private readonly runs: AgentRunRepository,
    @Inject(AgentRunEventBus) private readonly bus: AgentRunEventBus,
    @Inject(AgentSkillService) private readonly skills: AgentSkillService,
    @Inject(ExecutableSkillService) private readonly executableSkills: ExecutableSkillService,
  ) {}

  @Get('skills')
  async listSkills(@CurrentUser() user: AuthenticatedUser) {
    return this.skills.listMarket(user.id)
  }

  @Get('skills/executable/candidates')
  async listExecutableSkillCandidates(@CurrentUser() user: AuthenticatedUser) {
    const skills = await this.executableSkills.listCandidates(user.id)
    return skills.map(({ id, name, title, description }) => ({ id, name, title, description }))
  }

  @Put('skills/:skillId/install')
  async installSkill(@Param('skillId') skillId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.skills.install(user.id, skillId)
  }

  @Patch('skills/:skillId')
  async updateSkill(
    @Param('skillId') skillId: string,
    @Body() body: UpdateAgentSkillDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.skills.setEnabled(user.id, skillId, body.enabled)
  }

  @Delete('skills/:skillId/install')
  @HttpCode(204)
  async uninstallSkill(
    @Param('skillId') skillId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.skills.uninstall(user.id, skillId)
  }

  @Post('threads')
  async createThread(@Body() body: CreateAgentThreadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.agent.createThread(user, body)
  }

  @Get('threads')
  async listThreads(
    @Query() query: ListAgentThreadsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agent.listThreads(user, query)
  }

  @Get('threads/:threadId')
  async getThread(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agent.getThread(user, threadId)
  }

  @Patch('threads/:threadId')
  async renameThread(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body() body: UpdateAgentThreadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agent.renameThread(user, threadId, body.title)
  }

  @Delete('threads/:threadId')
  @HttpCode(204)
  async deleteThread(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.agent.deleteThread(user, threadId)
  }

  @Post('threads/:threadId/runs')
  @HttpCode(202)
  async createRun(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body() body: CreateAgentRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agent.createRun(user, threadId, body.input, body.skills ?? [])
  }

  @Post('runs/:runId/cancel')
  async cancelRun(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agent.cancelRun(user, runId)
  }

  @Get('runs/:runId/events')
  async streamEvents(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Query('after') after: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    await this.agent.assertRunOwner(user, runId)
    const cursor = parseCursor(after)

    this.openStream(response)

    let lastSequence = cursor
    let closed = false
    let notify: (() => void) | null = null
    const queue: AgentStreamEvent[] = []

    const unsubscribe = this.bus.subscribe(runId, (event) => {
      queue.push(event)
      notify?.()
    })
    const onClose = () => {
      closed = true
      notify?.()
    }
    request.once('aborted', onClose)
    response.once('close', onClose)

    const writeEvent = (event: AgentStreamEvent): boolean => {
      if (event.sequence <= lastSequence) return false
      lastSequence = event.sequence
      writeData(response, event)
      return event.type === 'run-terminal'
    }

    try {
      const persisted = await this.runs.listEventsAfter(runId, cursor)
      for (const row of persisted) {
        if (writeEvent(row.payload as AgentStreamEvent)) {
          this.endStream(response)
          return
        }
      }

      while (!closed && !response.writableEnded) {
        if (queue.length === 0) {
          if (!this.bus.isActive(runId)) break
          await new Promise<void>((resolve) => {
            notify = resolve
          })
          notify = null
          continue
        }
        const event = queue.shift()
        if (event && writeEvent(event)) {
          this.endStream(response)
          return
        }
      }

      // run 已结束（总线关闭）：补读可能遗漏的尾部事件后结束。
      const tail = await this.runs.listEventsAfter(runId, lastSequence)
      for (const row of tail) writeEvent(row.payload as AgentStreamEvent)
      this.endStream(response)
    } finally {
      unsubscribe()
      request.removeListener('aborted', onClose)
      response.removeListener('close', onClose)
    }
  }

  private openStream(response: Response): void {
    response.status(200)
    response.set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    response.flushHeaders()
  }

  private endStream(response: Response): void {
    if (response.writableEnded) return
    response.write('data: [DONE]\n\n')
    response.end()
  }
}

function writeData(response: Response, payload: unknown): void {
  if (response.writableEnded) return
  response.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function parseCursor(after: string | undefined): number {
  if (after === undefined) return -1
  const parsed = Number.parseInt(after, 10)
  if (Number.isNaN(parsed) || parsed < -1) return -1
  return parsed
}
