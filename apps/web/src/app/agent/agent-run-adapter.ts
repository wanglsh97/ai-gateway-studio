import type {
  AgentMessage,
  AgentStreamEvent,
  AgentThreadSummary,
  AIGatewayClient,
} from '@aigateway/sdk'
import type {
  ChatModelAdapter,
  ChatModelRunResult,
  ThreadAssistantMessagePart,
  ThreadMessage,
  ThreadMessageLike,
} from '@assistant-ui/react'

export interface AgentRunAdapterContext {
  threadId: string | null
  model: string
  onThreadCreated: (thread: AgentThreadSummary) => void
  onRunCreated?: (run: { id: string; threadId: string }) => void
  onRunFinished?: () => void
}

export interface AgentRunMetadata extends Record<string, unknown> {
  model?: string
  runId?: string
  modelCalls?: number
  toolCalls?: number
  totalTokens?: number | null
}

type MutablePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args: Record<string, string | number | boolean | null>
      argsText: string
      result?: {
        summary: string
        status: string
        audit?: Record<string, string | number | boolean | null>
      }
      isError?: boolean
    }

/**
 * 把 Agent 后端（thread/run/SSE call-loop）接到 assistant-ui LocalRuntime。
 * 一次用户发送对应一次完整 run：reasoning / tool-call(+result) / text 都折叠进同一条 assistant 消息。
 */
export function createAgentRunAdapter(
  client: AIGatewayClient,
  getContext: () => AgentRunAdapterContext,
  onError?: (error: unknown) => void,
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const context = getContext()
      const input = latestUserText(messages)
      if (!input) return

      let threadId = context.threadId
      if (!threadId) {
        if (!context.model) throw new Error('没有可用的 Agent 模型')
        const created = await client.agent.threads.create({ model: context.model })
        threadId = created.id
        context.onThreadCreated(created)
      }

      const run = await client.agent.runs.create(threadId, { input })
      context.onRunCreated?.({ id: run.id, threadId })
      const metadata: AgentRunMetadata = { model: context.model, runId: run.id }
      const parts: MutablePart[] = []

      const cancel = () => {
        void client.agent.runs.cancel(run.id).catch(() => undefined)
      }
      abortSignal.addEventListener('abort', cancel, { once: true })

      try {
        for await (const event of client.agent.runs.subscribe(run.id, {
          after: -1,
          signal: abortSignal,
        })) {
          applyAgentEvent(parts, metadata, event)
          const content = toAssistantParts(parts)
          if (event.type === 'run-terminal') {
            const result: ChatModelRunResult = {
              content,
              metadata: { custom: { ...metadata } },
              status:
                event.status === 'cancelled'
                  ? { type: 'incomplete', reason: 'cancelled' }
                  : event.status === 'failed'
                    ? { type: 'incomplete', reason: 'error' }
                    : { type: 'complete', reason: 'stop' },
            }
            yield result
            context.onRunFinished?.()
            return
          }
          if (event.type === 'error') {
            throw new Error(event.error.message)
          }
          yield { content, metadata: { custom: { ...metadata } } }
        }
      } catch (error) {
        if (abortSignal.aborted) {
          yield {
            content: toAssistantParts(parts),
            status: { type: 'incomplete', reason: 'cancelled' },
            metadata: { custom: { ...metadata } },
          }
          return
        }
        onError?.(error)
        throw error
      } finally {
        abortSignal.removeEventListener('abort', cancel)
      }
    },
  }
}

export function agentMessagesToThreadMessages(
  messages: readonly AgentMessage[],
): ThreadMessageLike[] {
  const result: ThreadMessageLike[] = []
  let pending: {
    id: string
    role: 'assistant'
    content: MutablePart[]
    createdAt: Date
  } | null = null

  const flush = () => {
    if (!pending) return
    result.push({
      id: pending.id,
      role: 'assistant',
      content: toAssistantParts(pending.content),
      status: { type: 'complete', reason: 'stop' },
      createdAt: pending.createdAt,
    })
    pending = null
  }

  for (const message of messages) {
    if (message.role === 'user') {
      flush()
      result.push({
        id: message.id,
        role: 'user',
        content: message.parts.flatMap((part) =>
          part.type === 'text' ? [{ type: 'text' as const, text: part.text }] : [],
        ),
        createdAt: parseDate(message.createdAt),
      })
      continue
    }

    if (message.role === 'assistant') {
      if (!pending) {
        pending = {
          id: message.id,
          role: 'assistant',
          content: [],
          createdAt: parseDate(message.createdAt),
        }
      }
      for (const part of message.parts) {
        if (part.type === 'text') {
          pending.content.push({ type: 'text', text: part.text })
        } else if (part.type === 'reasoning') {
          pending.content.push({ type: 'reasoning', text: part.text })
        } else if (part.type === 'tool-call') {
          pending.content.push({
            type: 'tool-call',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            args: toJsonObject(part.args),
            argsText: JSON.stringify(part.args),
          })
        }
      }
      continue
    }

    for (const part of message.parts) {
      if (part.type !== 'tool-result' || !pending) continue
      const index = pending.content.findIndex(
        (item) => item.type === 'tool-call' && item.toolCallId === part.toolCallId,
      )
      if (index < 0) continue
      const toolCall = pending.content[index]
      if (!toolCall || toolCall.type !== 'tool-call') continue
      pending.content[index] = {
        ...toolCall,
        result: {
          summary: part.summary,
          status: part.status,
          ...(part.audit === undefined ? {} : { audit: toJsonObject(part.audit) }),
        },
        isError: part.isError,
      }
    }
  }

  flush()
  return result
}

function applyAgentEvent(
  parts: MutablePart[],
  metadata: AgentRunMetadata,
  event: AgentStreamEvent,
): void {
  switch (event.type) {
    case 'reasoning-delta':
      appendTextLike(parts, 'reasoning', event.delta)
      return
    case 'text-delta':
      appendTextLike(parts, 'text', event.delta)
      return
    case 'tool-call':
      parts.push({
        type: 'tool-call',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: toJsonObject(event.args),
        argsText: JSON.stringify(event.args),
      })
      return
    case 'tool-result': {
      const index = parts.findIndex(
        (part) => part.type === 'tool-call' && part.toolCallId === event.toolCallId,
      )
      if (index < 0) {
        parts.push({
          type: 'tool-call',
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: {},
          argsText: '{}',
          result: {
            summary: event.summary,
            status: event.status,
            ...(event.audit === undefined ? {} : { audit: toJsonObject(event.audit) }),
          },
          isError: event.isError,
        })
        return
      }
      const toolCall = parts[index]
      if (!toolCall || toolCall.type !== 'tool-call') return
      parts[index] = {
        ...toolCall,
        result: {
          summary: event.summary,
          status: event.status,
          ...(event.audit === undefined ? {} : { audit: toJsonObject(event.audit) }),
        },
        isError: event.isError,
      }
      return
    }
    case 'usage':
      metadata.modelCalls = event.usage.modelCalls
      metadata.toolCalls = event.usage.toolCalls
      metadata.totalTokens = event.usage.totalTokens
      return
    default:
      return
  }
}

function appendTextLike(parts: MutablePart[], type: 'text' | 'reasoning', delta: string): void {
  const last = parts.at(-1)
  if (last && last.type === type) {
    last.text += delta
    return
  }
  parts.push({ type, text: delta })
}

function toAssistantParts(parts: readonly MutablePart[]): ThreadAssistantMessagePart[] {
  return parts.map((part) => {
    if (part.type === 'tool-call') {
      return {
        type: 'tool-call',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.args,
        argsText: part.argsText,
        ...(part.result === undefined ? {} : { result: part.result }),
        ...(part.isError === undefined ? {} : { isError: part.isError }),
      } as ThreadAssistantMessagePart
    }
    return { ...part } as ThreadAssistantMessagePart
  })
}

function toJsonObject(
  value: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      entry === null
    ) {
      result[key] = entry
    } else if (entry !== undefined) {
      result[key] = JSON.stringify(entry)
    }
  }
  return result
}

function latestUserText(messages: readonly ThreadMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message || message.role !== 'user') continue
    return message.content
      .flatMap((part) => (part.type === 'text' ? [part.text] : []))
      .join('')
      .trim()
  }
  return ''
}

function parseDate(value: string): Date {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}
