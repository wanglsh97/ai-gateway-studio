import assert from 'node:assert/strict'
import test from 'node:test'

import type { ThreadMessage } from '@assistant-ui/react'

import { toGatewayMessages } from './agent-chat-adapter'

test('converts assistant-ui thread messages to the gateway contract', () => {
  const messages = [
    {
      id: 'user-1',
      role: 'user',
      content: [{ type: 'text', text: '  hello  ' }],
      attachments: [],
      createdAt: new Date('2026-01-01'),
      metadata: { custom: {} },
    },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: [{ type: 'text', text: 'world' }],
      status: { type: 'complete', reason: 'stop' },
      createdAt: new Date('2026-01-01'),
      metadata: {
        unstable_state: null,
        unstable_annotations: [],
        unstable_data: [],
        steps: [],
        custom: {},
      },
    },
  ] satisfies ThreadMessage[]

  assert.deepEqual(toGatewayMessages(messages), [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'world' },
  ])
})
