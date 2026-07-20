import {
  AGENT_MESSAGE_ROLES,
  AGENT_RUN_LIMIT_REASONS,
  AGENT_RUN_STATUSES,
  AGENT_RUN_TERMINAL_STATUSES,
  AGENT_TOOL_CALL_STATUSES,
  type AgentMessageRole,
  type AgentRunLimitReason,
  type AgentRunStatus,
  type AgentRunTerminalStatus,
  type AgentRunUsage,
  type AgentStreamEvent,
  type AgentToolCallStatus,
} from './agent-types.js'
import { AIGatewayProtocolError } from './errors.js'
import type { GatewayError } from './types.js'

/**
 * Agent 事件线协议（wire）。
 *
 * API 与 SDK 共享同一套编解码，保证持久化事件、SSE 投影与客户端解析对齐。
 * wire 使用 snake_case 字段，`type` 保留连字符事件名。
 */
export type AgentEventWire = Record<string, unknown> & {
  type: string
  sequence: number
  run_id: string
}

export function encodeAgentEvent(event: AgentStreamEvent): AgentEventWire {
  const base = { type: event.type, sequence: event.sequence, run_id: event.runId }
  switch (event.type) {
    case 'run-status':
      return { ...base, status: event.status }
    case 'run-terminal':
      return { ...base, status: event.status, limit_reason: event.limitReason }
    case 'message-start':
      return { ...base, message_id: event.messageId, role: event.role }
    case 'text-delta':
      return { ...base, message_id: event.messageId, delta: event.delta }
    case 'reasoning-delta':
      return { ...base, message_id: event.messageId, delta: event.delta }
    case 'message-end':
      return { ...base, message_id: event.messageId }
    case 'tool-call':
      return {
        ...base,
        message_id: event.messageId,
        tool_call_id: event.toolCallId,
        tool_name: event.toolName,
        args: event.args,
      }
    case 'tool-status':
      return {
        ...base,
        tool_call_id: event.toolCallId,
        tool_name: event.toolName,
        status: event.status,
      }
    case 'tool-result':
      return {
        ...base,
        tool_call_id: event.toolCallId,
        tool_name: event.toolName,
        status: event.status,
        is_error: event.isError,
        summary: event.summary,
        ...(event.audit === undefined ? {} : { audit: event.audit }),
      }
    case 'usage':
      return { ...base, usage: encodeUsage(event.usage) }
    case 'error':
      return { ...base, error: event.error }
    default: {
      const exhaustive: never = event
      throw new TypeError(`Unknown agent event: ${JSON.stringify(exhaustive)}`)
    }
  }
}

export function decodeAgentEvent(value: unknown, expectedRunId?: string): AgentStreamEvent {
  const record = asRecord(value)
  if (!record) throw protocol('Agent event must be an object')

  const type = stringValue(record.type)
  const sequence = record.sequence
  const runId = stringValue(record.run_id)
  if (!type) throw protocol('Agent event type is invalid')
  if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 0) {
    throw protocol('Agent event sequence must be a non-negative integer')
  }
  if (!runId) throw protocol('Agent event run_id is invalid')
  if (expectedRunId !== undefined && runId !== expectedRunId) {
    throw protocol('Agent event run_id does not match the subscribed run')
  }

  const base = { sequence, runId }

  switch (type) {
    case 'run-status':
      return { type, ...base, status: runStatus(record.status) }
    case 'run-terminal':
      return {
        type,
        ...base,
        status: terminalStatus(record.status),
        limitReason: limitReason(record.limit_reason),
      }
    case 'message-start':
      return { type, ...base, messageId: id(record.message_id), role: role(record.role) }
    case 'text-delta':
      return { type, ...base, messageId: id(record.message_id), delta: text(record.delta) }
    case 'reasoning-delta':
      return { type, ...base, messageId: id(record.message_id), delta: text(record.delta) }
    case 'message-end':
      return { type, ...base, messageId: id(record.message_id) }
    case 'tool-call':
      return {
        type,
        ...base,
        messageId: id(record.message_id),
        toolCallId: id(record.tool_call_id),
        toolName: id(record.tool_name),
        args: argsRecord(record.args),
      }
    case 'tool-status':
      return {
        type,
        ...base,
        toolCallId: id(record.tool_call_id),
        toolName: id(record.tool_name),
        status: toolStatus(record.status),
      }
    case 'tool-result': {
      const audit = asRecord(record.audit)
      return {
        type,
        ...base,
        toolCallId: id(record.tool_call_id),
        toolName: id(record.tool_name),
        status: toolStatus(record.status),
        isError: bool(record.is_error),
        summary: text(record.summary),
        ...(audit === undefined ? {} : { audit }),
      }
    }
    case 'usage':
      return { type, ...base, usage: decodeUsage(record.usage) }
    case 'error':
      return { type, ...base, error: gatewayError(record.error) }
    default:
      throw protocol(`Agent event has an unknown type "${type}"`)
  }
}

function encodeUsage(usage: AgentRunUsage): Record<string, unknown> {
  return {
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
    estimated_cost_cny: usage.estimatedCostCny,
    usage_unknown: usage.usageUnknown,
    model_calls: usage.modelCalls,
    tool_calls: usage.toolCalls,
    web_fetch_calls: usage.webFetchCalls,
  }
}

function decodeUsage(value: unknown): AgentRunUsage {
  const usage = asRecord(value)
  if (!usage) throw protocol('Agent usage payload is invalid')
  return {
    inputTokens: nullableNumber(usage.input_tokens),
    outputTokens: nullableNumber(usage.output_tokens),
    totalTokens: nullableNumber(usage.total_tokens),
    estimatedCostCny: nullableString(usage.estimated_cost_cny),
    usageUnknown: bool(usage.usage_unknown),
    modelCalls: count(usage.model_calls),
    toolCalls: count(usage.tool_calls),
    webFetchCalls: count(usage.web_fetch_calls),
  }
}

function gatewayError(value: unknown): GatewayError {
  const error = asRecord(value)
  const requestId = stringValue(error?.requestId)
  const code = stringValue(error?.code)
  const message = stringValue(error?.message)
  const retryable = error?.retryable
  if (!error || !requestId || !code || !message || typeof retryable !== 'boolean') {
    throw protocol('Agent error payload is invalid')
  }
  const details = asRecord(error.details)
  return {
    requestId,
    code,
    message,
    retryable,
    ...(details === undefined ? {} : { details }),
  }
}

function runStatus(value: unknown): AgentRunStatus {
  const status = stringValue(value)
  if (!status || !(AGENT_RUN_STATUSES as readonly string[]).includes(status)) {
    throw protocol('Agent run status is invalid')
  }
  return status as AgentRunStatus
}

function terminalStatus(value: unknown): AgentRunTerminalStatus {
  const status = stringValue(value)
  if (!status || !(AGENT_RUN_TERMINAL_STATUSES as readonly string[]).includes(status)) {
    throw protocol('Agent run terminal status is invalid')
  }
  return status as AgentRunTerminalStatus
}

function limitReason(value: unknown): AgentRunLimitReason | null {
  if (value === null || value === undefined) return null
  const reason = stringValue(value)
  if (!reason || !(AGENT_RUN_LIMIT_REASONS as readonly string[]).includes(reason)) {
    throw protocol('Agent run limit reason is invalid')
  }
  return reason as AgentRunLimitReason
}

function role(value: unknown): AgentMessageRole {
  const role = stringValue(value)
  if (!role || !(AGENT_MESSAGE_ROLES as readonly string[]).includes(role)) {
    throw protocol('Agent message role is invalid')
  }
  return role as AgentMessageRole
}

function toolStatus(value: unknown): AgentToolCallStatus {
  const status = stringValue(value)
  if (!status || !(AGENT_TOOL_CALL_STATUSES as readonly string[]).includes(status)) {
    throw protocol('Agent tool call status is invalid')
  }
  return status as AgentToolCallStatus
}

function id(value: unknown): string {
  const parsed = stringValue(value)
  if (!parsed) throw protocol('Agent event identifier is invalid')
  return parsed
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw protocol('Agent event text field must be a string')
  return value
}

function argsRecord(value: unknown): Record<string, unknown> {
  const record = asRecord(value)
  if (!record) throw protocol('Agent tool call args must be an object')
  return record
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw protocol('Agent event boolean field is invalid')
  return value
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw protocol('Agent usage count must be a non-negative integer')
  }
  return value
}

function nullableNumber(value: unknown): number | null {
  if (value === null || typeof value === 'number') return value
  throw protocol('Agent usage token value must be a number or null')
}

function nullableString(value: unknown): string | null {
  if (value === null || typeof value === 'string') return value
  throw protocol('Agent usage cost value must be a string or null')
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function protocol(message: string): AIGatewayProtocolError {
  return new AIGatewayProtocolError('unknown', message)
}
