import { Injectable } from '@nestjs/common'

export interface AgentMemoryEntry {
  id: string
  version: string
  scope: 'user' | 'thread'
  kind: 'profile' | 'preference' | 'fact' | 'task-state'
  content: string
}

export interface AgentMemoryProvider {
  recall(input: { userId: string; threadId: string }): Promise<readonly AgentMemoryEntry[]>
}

export const AGENT_MEMORY_PROVIDER = Symbol('AGENT_MEMORY_PROVIDER')

/** V1 不扫描、提取或持久化长期 Memory。 */
@Injectable()
export class EmptyAgentMemoryProvider implements AgentMemoryProvider {
  async recall(input: { userId: string; threadId: string }): Promise<readonly AgentMemoryEntry[]> {
    void input
    return []
  }
}
