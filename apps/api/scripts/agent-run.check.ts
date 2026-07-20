import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import type { ConfigService } from '@nestjs/config'

import { ChatAdapterRegistry } from '../src/chat/adapters/chat-adapter.registry'
import { MockChatAdapter } from '../src/chat/adapters/mock-chat-adapter'
import type { ChatFailoverService } from '../src/chat/chat-failover.service'
import { ChatModelCatalog } from '../src/chat/chat-model-catalog'
import { ModelInvocationService } from '../src/chat/model-invocation.service'
import type { ProviderHealthService } from '../src/chat/provider-health.service'
import { PrismaService } from '../src/database/prisma.service'
import { AgentMessageRepository } from '../src/agent/agent-message.repository'
import { AgentRunEventBus } from '../src/agent/agent-run-event-bus'
import { AgentRunRepository } from '../src/agent/agent-run.repository'
import { AgentRunService } from '../src/agent/agent-run.service'
import { AgentToolRegistry } from '../src/agent/tools/agent-tool.registry'
import { webFetchFixtureTool } from '../src/agent/tools/web-fetch-fixture.tool'

/**
 * Agent run 持久化集成检查（tsx + 真实 PostgreSQL，不联网）。
 *
 * 验证 run 状态机、事件 sequence、消息 parts 快照与工具调用落库。
 * 通过 `pnpm test:agent-run` 执行（需要 DATABASE_URL 指向可用的本地 Postgres）。
 */
function fakeConfig(): ConfigService {
  return {
    getOrThrow: (key: string) => {
      const value = process.env[key]
      if (!value) throw new Error(`missing env ${key}`)
      return value
    },
    get: () => undefined,
  } as unknown as ConfigService
}

function buildModelInvocation(): ModelInvocationService {
  const registry = new ChatAdapterRegistry([new MockChatAdapter({ chunks: ['未使用'], delayMs: 0 })])
  const catalog = new ChatModelCatalog(registry)
  const failover = { resolve: () => undefined } as unknown as ChatFailoverService
  const providerHealth = {
    recordSuccess: async () => undefined,
    recordFailure: async () => undefined,
  } as unknown as ProviderHealthService
  return new ModelInvocationService(catalog, registry, failover, providerHealth)
}

async function main(): Promise<void> {
  const prisma = new PrismaService(fakeConfig())
  const runs = new AgentRunRepository(prisma)
  const messages = new AgentMessageRepository(prisma)
  const tools = new AgentToolRegistry([webFetchFixtureTool])
  const bus = new AgentRunEventBus()
  const service = new AgentRunService(runs, messages, tools, buildModelInvocation(), bus)

  const user = await prisma.user.create({
    data: {
      githubId: `agent-check-${randomUUID().slice(0, 8)}`,
      githubUsername: 'agent-check',
      lastLoginAt: new Date(),
    },
  })
  const thread = await prisma.agentThread.create({
    data: { userId: user.id, title: 'run check', modelId: 'qwen3.7-plus', provider: 'qwen' },
  })

  try {
    const input = 'FETCH:1 请阅读 https://example.com/ 并总结'
    const run = await runs.create({ threadId: thread.id, userId: user.id, input })
    await messages.appendUserMessage(thread.id, run.id, input)

    await service.execute({
      runId: run.id,
      threadId: thread.id,
      userId: user.id,
      modelId: 'qwen3.7-plus',
      provider: 'qwen',
      input,
    })

    const finalRun = await prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } })
    assert.equal(finalRun.status, 'SUCCEEDED', 'run 应成功终结')
    assert.equal(finalRun.modelCallCount, 2, '应有两次模型调用')
    assert.equal(finalRun.toolCallCount, 1, '应有一次工具调用')
    assert.equal(finalRun.webFetchCount, 1, '应有一次 web_fetch')

    const events = await prisma.agentEvent.findMany({
      where: { runId: run.id },
      orderBy: { sequence: 'asc' },
    })
    assert.ok(events.length >= 5, '应持久化多个事件')
    events.forEach((event, index) => assert.equal(event.sequence, index, 'sequence 应连续'))
    assert.equal(events[0]?.type, 'run-status')
    assert.equal(events.at(-1)?.type, 'run-terminal')
    assert.equal(finalRun.lastSequence, events.at(-1)?.sequence)

    const threadMessages = await messages.listForThread(thread.id)
    const roles = threadMessages.map((message) => message.role)
    assert.deepEqual(roles, ['USER', 'ASSISTANT', 'TOOL', 'ASSISTANT'], '消息快照顺序应正确')

    const toolCalls = await prisma.agentToolCall.findMany({ where: { runId: run.id } })
    assert.equal(toolCalls.length, 1)
    assert.equal(toolCalls[0]?.toolName, 'web_fetch')
    assert.equal(toolCalls[0]?.status, 'SUCCEEDED')

    console.log('agent-run.check PASS: run 状态机、事件 sequence、消息快照与工具调用均已持久化')
  } finally {
    await prisma.agentThread.delete({ where: { id: thread.id } }).catch(() => undefined)
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined)
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('agent-run.check FAILED')
  console.error(error)
  process.exitCode = 1
})
