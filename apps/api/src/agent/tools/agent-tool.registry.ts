import { Inject, Injectable } from '@nestjs/common'

import type { AgentToolContext, AgentToolDefinition, AgentToolResult } from './agent-tool'
import { AgentToolExecutionError } from './agent-tool'
import { validateToolArguments } from './tool-args.validation'

export const AGENT_TOOLS = Symbol('AGENT_TOOLS')

export class AgentToolNotRegisteredError extends Error {
  constructor(readonly toolName: string) {
    super(`Agent tool "${toolName}" is not registered`)
    this.name = 'AgentToolNotRegisteredError'
  }
}

export class DuplicateAgentToolError extends Error {
  constructor(readonly toolName: string) {
    super(`Agent tool "${toolName}" is registered more than once`)
    this.name = 'DuplicateAgentToolError'
  }
}

export class UnsupportedAgentToolApprovalError extends Error {
  constructor(readonly toolName: string) {
    super(`Agent tool "${toolName}" requires approval, but V1 has no approval flow`)
    this.name = 'UnsupportedAgentToolApprovalError'
  }
}

/**
 * 服务端内存工具 registry（allowlist）。
 *
 * Agent runtime 只解析已注册工具；模型给出的未注册工具名一律拒绝，不执行任意代码。
 * 执行前按工具 JSON Schema 校验参数；无效参数不调用工具 execute（无出站请求）。
 */
@Injectable()
export class AgentToolRegistry {
  private readonly tools: ReadonlyMap<string, AgentToolDefinition>

  constructor(@Inject(AGENT_TOOLS) tools: readonly AgentToolDefinition[]) {
    const byName = new Map<string, AgentToolDefinition>()
    for (const tool of tools) {
      if (tool.approvalPolicy === 'explicit') {
        throw new UnsupportedAgentToolApprovalError(tool.name)
      }
      if (byName.has(tool.name)) throw new DuplicateAgentToolError(tool.name)
      byName.set(tool.name, tool)
    }
    this.tools = byName
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  get(name: string): AgentToolDefinition {
    const tool = this.tools.get(name)
    if (!tool) throw new AgentToolNotRegisteredError(name)
    return tool
  }

  list(): readonly AgentToolDefinition[] {
    return [...this.tools.values()]
  }

  /**
   * 解析工具、校验参数并执行。未知工具抛错；无效参数返回规范化失败结果且不调用 execute。
   */
  async execute(
    name: string,
    rawArgs: unknown,
    context: AgentToolContext,
  ): Promise<AgentToolResult> {
    const tool = this.get(name)
    if (context.signal.aborted) {
      throw new AgentToolExecutionError({
        code: 'AGENT_TOOL_ABORTED',
        message: '工具执行已取消',
        summary: '工具已取消',
      })
    }

    const validation = validateToolArguments(tool.parameters, rawArgs)
    if (!validation.ok) {
      return {
        content: validation.message,
        summary: '工具参数无效',
        isError: true,
        audit: { code: validation.code, issues: validation.issues },
      }
    }

    return tool.execute(validation.args, context)
  }
}
