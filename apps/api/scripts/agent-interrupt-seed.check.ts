import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { AppModule } from '../src/app.module'
import { configureApplication } from '../src/configure-app'
import { AgentRunRepository } from '../src/agent/agent-run.repository'
import { PrismaService } from '../src/database/prisma.service'

/**
 * 为浏览器验证 2.7 准备一条“服务重启中断”会话：先写入 RUNNING run，再执行 interrupt 清理。
 * 输出 threadId 供打开 /agent?thread=...
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  configureApplication(app)
  await app.init()

  const prisma = app.get(PrismaService)
  const runs = app.get(AgentRunRepository)

  const latestSession = await prisma.userSession.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  })
  if (!latestSession) {
    throw new Error('没有已登录用户会话，请先在浏览器登录后再运行本脚本')
  }
  const user = latestSession.user

  const thread = await prisma.agentThread.create({
    data: {
      userId: user.id,
      title: '中断状态验证会话',
      modelId: 'qwen3.7-plus',
      provider: 'qwen',
    },
  })

  const run = await prisma.agentRun.create({
    data: {
      threadId: thread.id,
      userId: user.id,
      status: 'RUNNING',
      input: '模拟服务重启前的任务',
      lastSequence: 1,
    },
  })

  await prisma.agentMessage.createMany({
    data: [
      {
        threadId: thread.id,
        runId: run.id,
        role: 'USER',
        sequence: 0,
        parts: [{ type: 'text', text: '模拟服务重启前的任务' }],
      },
      {
        threadId: thread.id,
        runId: run.id,
        role: 'ASSISTANT',
        sequence: 1,
        parts: [{ type: 'text', text: '这是重启前未完成的半成品回答…' }],
      },
    ],
  })

  const result = await runs.interruptAbandonedRuns()
  console.log(
    JSON.stringify({
      userId: user.id,
      githubUsername: user.githubUsername,
      threadId: thread.id,
      runId: run.id,
      interrupted: result,
      openPath: `/agent?thread=${thread.id}`,
    }),
  )

  await app.close()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
