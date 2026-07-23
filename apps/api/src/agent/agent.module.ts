import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { ChatModule } from '../chat/chat.module'
import { RedisModule } from '../redis/redis.module'
import { RequestLifecycleModule } from '../request-lifecycle/request-lifecycle.module'
import { UserAuthModule } from '../user-auth/user-auth.module'
import { AgentActiveRunLock } from './agent-active-run.lock'
import { AgentContextPreparer } from './context/agent-context-preparer'
import { AgentContextSummaryRepository } from './context/agent-context-summary.repository'
import { AgentContextSummaryService } from './context/agent-context-summary.service'
import { AgentController } from './agent.controller'
import { AgentMessageRepository } from './agent-message.repository'
import { AGENT_MCP_REGISTRY, EmptyAgentMcpRegistry } from './mcp/agent-mcp.registry'
import { AGENT_MEMORY_PROVIDER, EmptyAgentMemoryProvider } from './memory/agent-memory.provider'
import { AgentRunEventBus } from './agent-run-event-bus'
import { AgentRunRepository } from './agent-run.repository'
import { AgentRunService } from './agent-run.service'
import { AgentService } from './agent.service'
import { AgentStartupCleanupService } from './agent-startup-cleanup.service'
import { AgentThreadRepository } from './agent-thread.repository'
import { AgentPromptComposer } from './prompt/agent-prompt.composer'
import { AgentExecutionSessionService } from './sandbox/agent-execution-session.service'
import { FakeSandboxRuntime } from './sandbox/fake-sandbox-runtime'
import { SANDBOX_RUNTIME_PORT } from './sandbox/sandbox-runtime.port'
import { AGENT_SKILL_REGISTRY } from './skills/agent-skill.registry'
import { AgentSkillRepository } from './skills/agent-skill.repository'
import { AgentSkillService } from './skills/agent-skill.service'
import { ExecutableSkillBootstrap } from './skills/executable-skill.bootstrap'
import { MOCK_EXECUTABLE_SKILL_PACKAGE } from './skills/executable-skill.fixture'
import { ExecutableSkillRepository } from './skills/executable-skill.repository'
import { ExecutableSkillService } from './skills/executable-skill.service'
import { PlatformAgentSkillCatalog } from './skills/platform-agent-skill.catalog'
import { InMemorySkillObjectStore } from './skills/storage/in-memory-skill-object-store'
import {
  AliyunOssSkillObjectStore,
  createAliyunOssClient,
} from './skills/storage/aliyun-oss-skill-object-store'
import { PrismaSkillPackageProjectionReader } from './skills/storage/skill-package-projection.reader'
import { SKILL_OBJECT_STORE_PORT } from './skills/storage/skill-object-store.port'
import { AGENT_TOOLS, AgentToolRegistry } from './tools/agent-tool.registry'
import { createExecutableSkillTools } from './tools/executable-skill.tools'
import type { AgentToolDefinition } from './tools/agent-tool'
import { webFetchFixtureTool } from './tools/web-fetch-fixture.tool'
import { webFetchTool } from './tools/web-fetch.tool'

function resolveAgentTools(sessions: AgentExecutionSessionService): readonly AgentToolDefinition[] {
  // CI/确定性 E2E 可显式启用 fixture；默认使用生产级联网 web_fetch。
  const webTool =
    process.env.AGENT_WEB_FETCH_FIXTURE === 'true' ? webFetchFixtureTool : webFetchTool
  return [webTool, ...createExecutableSkillTools(sessions)]
}

/**
 * AgentModule：通用 Web Agent 的模块化单体边界。
 *
 * 本 change 分阶段落地：先建立持久化端口与 owner 过滤，随后接入 ModelInvocationPort、
 * Pi harness bridge、Tool registry、run 状态机与资源式 API。厂商协议与 Pi 运行时类型
 * 始终限制在服务端，不进入 SDK 公共面或浏览器。
 */
@Module({
  imports: [ConfigModule, UserAuthModule, ChatModule, RequestLifecycleModule, RedisModule],
  controllers: [AgentController],
  providers: [
    AgentThreadRepository,
    AgentRunRepository,
    AgentMessageRepository,
    AgentRunEventBus,
    AgentActiveRunLock,
    AgentContextPreparer,
    AgentContextSummaryRepository,
    AgentContextSummaryService,
    AgentRunService,
    AgentService,
    AgentStartupCleanupService,
    AgentPromptComposer,
    PlatformAgentSkillCatalog,
    AgentSkillRepository,
    AgentSkillService,
    { provide: AGENT_SKILL_REGISTRY, useExisting: AgentSkillService },
    ExecutableSkillRepository,
    ExecutableSkillService,
    ExecutableSkillBootstrap,
    PrismaSkillPackageProjectionReader,
    {
      provide: SKILL_OBJECT_STORE_PORT,
      inject: [ConfigService, PrismaSkillPackageProjectionReader],
      useFactory: (config: ConfigService, projections: PrismaSkillPackageProjectionReader) => {
        if (config.get<string>('SKILL_OBJECT_STORE_DRIVER') !== 'oss') {
          return new InMemorySkillObjectStore({
            skillPackages: [MOCK_EXECUTABLE_SKILL_PACKAGE],
          })
        }
        const { client, bucket } = createAliyunOssClient(config)
        return new AliyunOssSkillObjectStore(client, bucket, projections)
      },
    },
    {
      provide: FakeSandboxRuntime,
      useFactory: () =>
        new FakeSandboxRuntime({
          commands: [
            {
              command: 'node scripts/clean.mjs',
              stdout: 'Mock Skill completed\n',
              durationMs: 25,
            },
          ],
        }),
    },
    { provide: SANDBOX_RUNTIME_PORT, useExisting: FakeSandboxRuntime },
    AgentExecutionSessionService,
    EmptyAgentMcpRegistry,
    { provide: AGENT_MCP_REGISTRY, useExisting: EmptyAgentMcpRegistry },
    EmptyAgentMemoryProvider,
    { provide: AGENT_MEMORY_PROVIDER, useExisting: EmptyAgentMemoryProvider },
    {
      provide: AGENT_TOOLS,
      inject: [AgentExecutionSessionService],
      useFactory: (sessions: AgentExecutionSessionService): readonly AgentToolDefinition[] =>
        resolveAgentTools(sessions),
    },
    AgentToolRegistry,
  ],
  exports: [
    AgentThreadRepository,
    AgentRunRepository,
    AgentMessageRepository,
    AgentRunEventBus,
    AgentRunService,
    AgentActiveRunLock,
    AgentToolRegistry,
    ExecutableSkillService,
    AgentExecutionSessionService,
  ],
})
export class AgentModule {}
