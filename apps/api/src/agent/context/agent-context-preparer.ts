import { Injectable } from '@nestjs/common'

import type { ChatAdapterMessage, ChatAdapterToolDefinition } from '../../chat/adapters/chat-adapter'
import { calculateAgentContextBudget } from './agent-context-budget'
import type { AgentContextBudget } from './agent-context-budget'
import { compressAgentContext } from './agent-context-compressor'
import { AgentTokenEstimator } from './agent-token-estimator'

export interface PreparedAgentContext {
  messages: ChatAdapterMessage[]
  budget: AgentContextBudget
  compressionNotes: string[]
}

@Injectable()
export class AgentContextPreparer {
  constructor(private readonly estimator = new AgentTokenEstimator()) {}

  prepare(input: {
    contextWindowTokens: number
    messages: readonly ChatAdapterMessage[]
    tools: readonly ChatAdapterToolDefinition[]
    maxOutputTokens?: number
  }): PreparedAgentContext {
    const before = calculateAgentContextBudget({ ...input, estimator: this.estimator })
    if (before.level === 'none' || before.level === 'forced') {
      return { messages: input.messages.map((message) => ({ ...message })), budget: before, compressionNotes: [] }
    }
    const compressed = compressAgentContext(input.messages, before.level)
    const budget = calculateAgentContextBudget({
      ...input,
      messages: compressed.messages,
      estimator: this.estimator,
    })
    return { messages: compressed.messages, budget, compressionNotes: compressed.notes }
  }
}
