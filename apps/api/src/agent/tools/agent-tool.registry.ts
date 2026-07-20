import { Inject, Injectable } from '@nestjs/common'

import type { AgentToolDefinition } from './agent-tool'

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

/**
 * 服务端内存工具 registry（allowlist）。
 *
 * Agent runtime 只解析已注册工具；模型给出的未注册工具名一律拒绝，不执行任意代码。
 * 未来 skills/MCP 通过组合器向 registry 贡献工具，而不是修改 Agent loop。
 */
@Injectable()
export class AgentToolRegistry {
  private readonly tools: ReadonlyMap<string, AgentToolDefinition>

  constructor(@Inject(AGENT_TOOLS) tools: readonly AgentToolDefinition[]) {
    const byName = new Map<string, AgentToolDefinition>()
    for (const tool of tools) {
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
}
