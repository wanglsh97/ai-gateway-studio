import 'reflect-metadata'

import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'

import { NestFactory } from '@nestjs/core'

import type { AgentStreamEvent } from '@aigateway/sdk'

import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/configure-app'
import { PrismaService } from '../src/database/prisma.service'
import { USER_SESSION_COOKIE } from '../src/user-auth/user-auth.constants'
import { UserSessionService } from '../src/user-auth/user-session.service'

/**
 * Agent 端到端检查（tsx + 真实 HTTP + PostgreSQL，不依赖公网）。
 *
 * 串通：SDK → Agent API → Pi harness → Mock tool-calling Adapter → web_fetch fixture →
 * follow-up turn → SSE cursor → PostgreSQL RequestLog/BillingRecord。
 * 通过 `pnpm test:agent-e2e` 执行（需要本地 Postgres/Redis 与完整 .env）。
 */
// @aigateway/sdk 为 ESM（仅 import 条件），在 tsx/CJS 下用原生动态 import 加载其构建产物。
const nativeImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<typeof import('@aigateway/sdk')>

async function main(): Promise<void> {
  // 强制 Mock、确定性、零成本：仅启用 Mock Adapter，禁用所有真实 provider。
  // 必须在进程启动前经 test:agent-e2e 脚本以环境变量注入（@nestjs/config 不覆盖已有 process.env）。
  const { createAIGatewayClient } = await nativeImport('@aigateway/sdk')
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  configureApplication(app)
  await app.listen(0, '127.0.0.1')

  const address = app.getHttpServer().address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`
  const prisma = app.get(PrismaService)
  const sessions = app.get(UserSessionService)

  const githubId = `agent-e2e-${randomUUID().slice(0, 8)}`
  const { token, user } = await sessions.create({
    githubId,
    githubUsername: 'agent-e2e',
    displayName: null,
    avatarUrl: null,
    email: null,
  })

  const client = createAIGatewayClient({
    baseUrl,
    fetch: (input, init) =>
      globalThis.fetch(input, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), cookie: `${USER_SESSION_COOKIE}=${token}` },
      }),
  })

  let threadId: string | undefined
  try {
    const models = await client.models.list()
    const model = models.find((candidate) => candidate.enabled && candidate.capabilities.includes('chat'))
    assert.ok(model, '需要至少一个启用的 Chat 模型（开发环境应启用 Mock）')

    const thread = await client.agent.threads.create({ model: model.id })
    threadId = thread.id

    const run = await client.agent.runs.create(thread.id, {
      input: 'FETCH:1 请阅读 https://example.com/ 并总结要点',
    })
    assert.equal(run.status, 'running')

    const events: AgentStreamEvent[] = []
    for await (const event of client.agent.runs.subscribe(run.id)) {
      events.push(event)
    }

    const types = events.map((event) => event.type)
    assert.ok(types.includes('tool-call'), '应出现 tool-call 事件')
    assert.ok(types.includes('tool-result'), '应出现 tool-result 事件')
    const terminal = events.at(-1)
    assert.equal(terminal?.type, 'run-terminal')
    assert.equal(terminal && 'status' in terminal ? terminal.status : undefined, 'succeeded')

    // sequence 从 0 起连续递增
    events.forEach((event, index) => assert.equal(event.sequence, index, 'SSE sequence 应连续递增'))

    // 断线补读：从中间 sequence 重新订阅，只应收到之后的事件
    const midpoint = Math.floor(events.length / 2)
    const replay: AgentStreamEvent[] = []
    for await (const event of client.agent.runs.subscribe(run.id, { after: midpoint })) {
      replay.push(event)
    }
    assert.ok(replay.every((event) => event.sequence > midpoint), '补读只应返回游标之后的事件')
    assert.equal(replay.at(-1)?.type, 'run-terminal')

    // 刷新恢复：thread 详情返回有序消息快照
    const detail = await client.agent.threads.get(thread.id)
    const roles = detail.messages.map((message) => message.role)
    assert.deepEqual(roles, ['user', 'assistant', 'tool', 'assistant'], '刷新后应恢复完整消息快照')
    assert.equal(detail.activeRun, null, 'run 已终结')

    // PostgreSQL：每次模型调用一条 RequestLog + 一对一 BillingRecord
    const requestLogs = await prisma.requestLog.findMany({
      where: { agentRunId: run.id },
      include: { billing: true },
    })
    assert.equal(requestLogs.length, 2, '两次模型调用应各有一条 RequestLog')
    for (const log of requestLogs) {
      assert.equal(log.capability, 'AGENT')
      assert.ok(log.billing, 'RequestLog 应有一对一 BillingRecord')
    }

    console.log('agent-e2e.check PASS: Web→SDK→API→Pi→Mock→web_fetch→follow-up→SSE→PostgreSQL 全链路成功')
  } finally {
    if (threadId) await prisma.agentThread.delete({ where: { id: threadId } }).catch(() => undefined)
    await prisma.requestLog.deleteMany({ where: { userId: user.id } }).catch(() => undefined)
    await prisma.userSession.deleteMany({ where: { userId: user.id } }).catch(() => undefined)
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined)
    await app.close()
  }
}

main().catch((error) => {
  console.error('agent-e2e.check FAILED')
  console.error(error)
  process.exitCode = 1
})
