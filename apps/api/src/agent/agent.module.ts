import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { ChatModule } from '../chat/chat.module'
import { RequestLifecycleModule } from '../request-lifecycle/request-lifecycle.module'
import { UserAuthModule } from '../user-auth/user-auth.module'
import { AgentController } from './agent.controller'
import { AgentMessageRepository } from './agent-message.repository'
import { AgentRunEventBus } from './agent-run-event-bus'
import { AgentRunRepository } from './agent-run.repository'
import { AgentRunService } from './agent-run.service'
import { AgentService } from './agent.service'
import { AgentThreadRepository } from './agent-thread.repository'
import { AGENT_TOOLS, AgentToolRegistry } from './tools/agent-tool.registry'
import type { AgentToolDefinition } from './tools/agent-tool'
import { webFetchFixtureTool } from './tools/web-fetch-fixture.tool'

/**
 * AgentModule：通用 Web Agent 的模块化单体边界。
 *
 * 本 change 分阶段落地：先建立持久化端口与 owner 过滤，随后接入 ModelInvocationPort、
 * Pi harness bridge、Tool registry、run 状态机与资源式 API。厂商协议与 Pi 运行时类型
 * 始终限制在服务端，不进入 SDK 公共面或浏览器。
 */
@Module({
  imports: [ConfigModule, UserAuthModule, ChatModule, RequestLifecycleModule],
  controllers: [AgentController],
  providers: [
    AgentThreadRepository,
    AgentRunRepository,
    AgentMessageRepository,
    AgentRunEventBus,
    AgentRunService,
    AgentService,
    {
      provide: AGENT_TOOLS,
      useFactory: (): readonly AgentToolDefinition[] => [webFetchFixtureTool],
    },
    AgentToolRegistry,
  ],
  exports: [
    AgentThreadRepository,
    AgentRunRepository,
    AgentMessageRepository,
    AgentRunEventBus,
    AgentRunService,
    AgentToolRegistry,
  ],
})
export class AgentModule {}
