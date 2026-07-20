import assert from 'node:assert/strict'
import test from 'node:test'

import type { AgentMessage } from '@aigateway/sdk'

import { agentMessagesToThreadMessages } from './agent-run-adapter'

test('merges tool results into the preceding assistant tool-call part', () => {
  const messages: AgentMessage[] = [
    {
      id: 'u1',
      role: 'user',
      parts: [{ type: 'text', text: '总结 https://example.com/' }],
      createdAt: '2026-07-20T00:00:00.000Z',
    },
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: '需要检索' },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'web_fetch',
          args: { url: 'https://example.com/' },
        },
      ],
      createdAt: '2026-07-20T00:00:01.000Z',
    },
    {
      id: 't1',
      role: 'tool',
      parts: [
        {
          type: 'tool-result',
          toolCallId: 'call_1',
          toolName: 'web_fetch',
          status: 'succeeded',
          isError: false,
          summary: '已抓取 example.com',
          audit: { status: 200, finalUrl: 'https://example.com/' },
        },
      ],
      createdAt: '2026-07-20T00:00:02.000Z',
    },
    {
      id: 'a2',
      role: 'assistant',
      parts: [{ type: 'text', text: '页面是 Example Domain' }],
      createdAt: '2026-07-20T00:00:03.000Z',
    },
  ]

  const threadMessages = agentMessagesToThreadMessages(messages)
  assert.equal(threadMessages.length, 2)
  assert.equal(threadMessages[0]?.role, 'user')

  const assistant = threadMessages[1]
  assert.equal(assistant?.role, 'assistant')
  assert.deepEqual(assistant && 'content' in assistant ? assistant.content : null, [
    { type: 'reasoning', text: '需要检索' },
    {
      type: 'tool-call',
      toolCallId: 'call_1',
      toolName: 'web_fetch',
      args: { url: 'https://example.com/' },
      argsText: '{"url":"https://example.com/"}',
      result: {
        summary: '已抓取 example.com',
        status: 'succeeded',
        audit: { status: 200, finalUrl: 'https://example.com/' },
      },
      isError: false,
    },
    { type: 'text', text: '页面是 Example Domain' },
  ])
})

test('marks the last assistant message incomplete when last run was interrupted', () => {
  const messages: AgentMessage[] = [
    {
      id: 'u1',
      role: 'user',
      parts: [{ type: 'text', text: '任务' }],
      createdAt: '2026-07-20T00:00:00.000Z',
    },
    {
      id: 'a1',
      role: 'assistant',
      parts: [{ type: 'text', text: '半成品' }],
      createdAt: '2026-07-20T00:00:01.000Z',
    },
  ]
  const threadMessages = agentMessagesToThreadMessages(messages, { lastRunStatus: 'interrupted' })
  const assistant = threadMessages[1]
  assert.equal(assistant?.role, 'assistant')
  assert.deepEqual(assistant && 'status' in assistant ? assistant.status : null, {
    type: 'incomplete',
    reason: 'error',
    error: '服务重启导致运行中断，未自动重放',
  })
})
