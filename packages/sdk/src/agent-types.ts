import type { GatewayError, TextModelId, Usage } from './types.js'

/**
 * Agent 公共契约。
 *
 * 本文件只暴露平台中立的业务契约，禁止泄漏 Pi harness 类型（Model/Context/AgentTool）
 * 或任何厂商响应结构。API 与 Web 只通过这些类型交换 Agent 数据。
 */

export const AGENT_RUN_STATUSES = [
  'running',
  'cancelling',
  'succeeded',
  'failed',
  'cancelled',
  'limit_reached',
  'interrupted',
] as const
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number]

export const AGENT_RUN_TERMINAL_STATUSES = [
  'succeeded',
  'failed',
  'cancelled',
  'limit_reached',
  'interrupted',
] as const
export type AgentRunTerminalStatus = (typeof AGENT_RUN_TERMINAL_STATUSES)[number]

export const AGENT_RUN_LIMIT_REASONS = [
  'model_calls',
  'tool_calls',
  'web_fetch_calls',
  'duration',
] as const
export type AgentRunLimitReason = (typeof AGENT_RUN_LIMIT_REASONS)[number]

export const AGENT_MESSAGE_ROLES = ['user', 'assistant', 'tool'] as const
export type AgentMessageRole = (typeof AGENT_MESSAGE_ROLES)[number]

export const AGENT_TOOL_CALL_STATUSES = ['running', 'succeeded', 'failed', 'cancelled'] as const
export type AgentToolCallStatus = (typeof AGENT_TOOL_CALL_STATUSES)[number]

export interface AgentTextPart {
  type: 'text'
  text: string
}

export interface AgentReasoningPart {
  type: 'reasoning'
  text: string
}

export interface AgentToolCallPart {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

export interface AgentToolResultPart {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  status: AgentToolCallStatus
  isError: boolean
  summary: string
  /** 工具无关的审计投影（如 web_fetch 的 URL/状态/字节数）。不含凭证或敏感响应头。 */
  audit?: Record<string, unknown>
}

export type AgentMessagePart =
  | AgentTextPart
  | AgentReasoningPart
  | AgentToolCallPart
  | AgentToolResultPart

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  parts: AgentMessagePart[]
  createdAt: string
}

export interface AgentRunUsage extends Usage {
  modelCalls: number
  toolCalls: number
  webFetchCalls: number
}

export interface AgentRunSummary {
  id: string
  threadId: string
  status: AgentRunStatus
  limitReason: AgentRunLimitReason | null
  usage: AgentRunUsage
  lastSequence: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface AgentThreadSummary {
  id: string
  title: string
  model: TextModelId
  createdAt: string
  updatedAt: string
}

export interface AgentThread extends AgentThreadSummary {
  messages: AgentMessage[]
  activeRun: AgentRunSummary | null
}

export interface CreateAgentThreadRequest {
  model: TextModelId
  title?: string
}

export interface UpdateAgentThreadRequest {
  title: string
}

export interface CreateAgentRunRequest {
  input: string
}

/**
 * Agent 事件流（已解析、camelCase）。
 *
 * 每个事件都带有单调递增的 `sequence`，客户端断线后可用最后一个 sequence 补读。
 */
export type AgentStreamEvent =
  | { type: 'run-status'; sequence: number; runId: string; status: AgentRunStatus }
  | {
      type: 'run-terminal'
      sequence: number
      runId: string
      status: AgentRunTerminalStatus
      limitReason: AgentRunLimitReason | null
    }
  | {
      type: 'message-start'
      sequence: number
      runId: string
      messageId: string
      role: AgentMessageRole
    }
  | { type: 'text-delta'; sequence: number; runId: string; messageId: string; delta: string }
  | { type: 'reasoning-delta'; sequence: number; runId: string; messageId: string; delta: string }
  | { type: 'message-end'; sequence: number; runId: string; messageId: string }
  | {
      type: 'tool-call'
      sequence: number
      runId: string
      messageId: string
      toolCallId: string
      toolName: string
      args: Record<string, unknown>
    }
  | {
      type: 'tool-status'
      sequence: number
      runId: string
      toolCallId: string
      toolName: string
      status: AgentToolCallStatus
    }
  | {
      type: 'tool-result'
      sequence: number
      runId: string
      toolCallId: string
      toolName: string
      status: AgentToolCallStatus
      isError: boolean
      summary: string
      audit?: Record<string, unknown>
    }
  | { type: 'usage'; sequence: number; runId: string; usage: AgentRunUsage }
  | { type: 'error'; sequence: number; runId: string; error: GatewayError }

export const AGENT_EVENT_SSE_DONE = '[DONE]' as const
