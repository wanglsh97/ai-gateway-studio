import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { UserAuthModule } from '../user-auth/user-auth.module'
import { AgentRunRepository } from './agent-run.repository'
import { AgentThreadRepository } from './agent-thread.repository'

/**
 * AgentModule：通用 Web Agent 的模块化单体边界。
 *
 * 本 change 分阶段落地：先建立持久化端口与 owner 过滤，随后接入 ModelInvocationPort、
 * Pi harness bridge、Tool registry、run 状态机与资源式 API。厂商协议与 Pi 运行时类型
 * 始终限制在服务端，不进入 SDK 公共面或浏览器。
 */
@Module({
  imports: [ConfigModule, UserAuthModule],
  providers: [AgentThreadRepository, AgentRunRepository],
  exports: [AgentThreadRepository, AgentRunRepository],
})
export class AgentModule {}
