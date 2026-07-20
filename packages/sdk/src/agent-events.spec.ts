import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decodeAgentEvent, encodeAgentEvent } from './agent-events.js'
import type { AgentStreamEvent } from './agent-types.js'
import { AIGatewayProtocolError } from './errors.js'

const runId = '00000000-0000-4000-8000-00000000abcd'

const events: AgentStreamEvent[] = [
  { type: 'run-status', sequence: 0, runId, status: 'running' },
  { type: 'message-start', sequence: 1, runId, messageId: 'm1', role: 'assistant' },
  { type: 'reasoning-delta', sequence: 2, runId, messageId: 'm1', delta: '思考中' },
  { type: 'text-delta', sequence: 3, runId, messageId: 'm1', delta: '正在处理' },
  {
    type: 'tool-call',
    sequence: 4,
    runId,
    messageId: 'm1',
    toolCallId: 't1',
    toolName: 'web_fetch',
    args: { url: 'https://example.com' },
  },
  { type: 'tool-status', sequence: 5, runId, toolCallId: 't1', toolName: 'web_fetch', status: 'running' },
  {
    type: 'tool-result',
    sequence: 6,
    runId,
    toolCallId: 't1',
    toolName: 'web_fetch',
    status: 'succeeded',
    isError: false,
    summary: '已抓取 example.com',
    audit: { finalUrl: 'https://example.com/', status: 200, bytes: 1234 },
  },
  { type: 'message-end', sequence: 7, runId, messageId: 'm1' },
  {
    type: 'usage',
    sequence: 8,
    runId,
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      estimatedCostCny: '0.00120000',
      usageUnknown: false,
      modelCalls: 2,
      toolCalls: 1,
      webFetchCalls: 1,
    },
  },
  {
    type: 'run-terminal',
    sequence: 9,
    runId,
    status: 'succeeded',
    limitReason: null,
  },
]

describe('agent event wire codec', () => {
  it('round-trips every event type through encode/decode with matching runId', () => {
    for (const event of events) {
      const wire = encodeAgentEvent(event)
      assert.equal(wire.run_id, runId)
      assert.equal(wire.type, event.type)
      const decoded = decodeAgentEvent(JSON.parse(JSON.stringify(wire)), runId)
      assert.deepEqual(decoded, event)
    }
  })

  it('decodes a terminal limit_reached event with an explicit reason', () => {
    const decoded = decodeAgentEvent(
      encodeAgentEvent({
        type: 'run-terminal',
        sequence: 12,
        runId,
        status: 'limit_reached',
        limitReason: 'web_fetch_calls',
      }),
      runId,
    )
    assert.deepEqual(decoded, {
      type: 'run-terminal',
      sequence: 12,
      runId,
      status: 'limit_reached',
      limitReason: 'web_fetch_calls',
    })
  })

  it('decodes an error event and preserves the gateway error envelope', () => {
    const decoded = decodeAgentEvent(
      {
        type: 'error',
        sequence: 3,
        run_id: runId,
        error: { requestId: 'r1', code: 'AGENT_STREAM_ERROR', message: '失败', retryable: true },
      },
      runId,
    )
    assert.deepEqual(decoded, {
      type: 'error',
      sequence: 3,
      runId,
      error: { requestId: 'r1', code: 'AGENT_STREAM_ERROR', message: '失败', retryable: true },
    })
  })

  it('rejects a run_id that does not match the subscribed run', () => {
    assert.throws(
      () => decodeAgentEvent({ type: 'run-status', sequence: 0, run_id: 'other', status: 'running' }, runId),
      AIGatewayProtocolError,
    )
  })

  it('rejects negative or non-integer sequences', () => {
    assert.throws(
      () => decodeAgentEvent({ type: 'run-status', sequence: -1, run_id: runId, status: 'running' }),
      AIGatewayProtocolError,
    )
    assert.throws(
      () => decodeAgentEvent({ type: 'run-status', sequence: 1.5, run_id: runId, status: 'running' }),
      AIGatewayProtocolError,
    )
  })

  it('rejects unknown event types and invalid enums', () => {
    assert.throws(
      () => decodeAgentEvent({ type: 'nope', sequence: 0, run_id: runId }),
      AIGatewayProtocolError,
    )
    assert.throws(
      () => decodeAgentEvent({ type: 'run-status', sequence: 0, run_id: runId, status: 'weird' }),
      AIGatewayProtocolError,
    )
  })
})
