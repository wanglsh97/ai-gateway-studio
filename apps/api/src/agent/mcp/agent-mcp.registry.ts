import { Injectable } from '@nestjs/common'

export interface AgentMcpServerDescriptor {
  id: string
  name: string
  version: string
  description: string
}

export interface AgentMcpRegistry {
  listServers(): readonly AgentMcpServerDescriptor[]
}

export const AGENT_MCP_REGISTRY = Symbol('AGENT_MCP_REGISTRY')

/** V1 不连接 MCP、不发现远程工具，也不读取任何 MCP 凭证。 */
@Injectable()
export class EmptyAgentMcpRegistry implements AgentMcpRegistry {
  listServers(): readonly AgentMcpServerDescriptor[] {
    return []
  }
}
