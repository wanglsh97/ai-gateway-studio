import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { chatViewReducer, initialChatViewState, readableChatError } from './chat-view-state'

describe('chatViewReducer', () => {
  it('keeps multiple turns and metadata while streaming the active assistant', () => {
    let state = chatViewReducer(initialChatViewState, { type: 'submit', prompt: '第一问' })
    state = chatViewReducer(state, {
      type: 'started',
      requestId: '00000000-0000-4000-8000-000000000001',
      model: 'qwen',
    })
    state = chatViewReducer(state, { type: 'delta', content: '第一答' })
    state = chatViewReducer(state, { type: 'complete' })
    state = chatViewReducer(state, { type: 'submit', prompt: '第二问' })
    state = chatViewReducer(state, { type: 'delta', content: '第二答' })
    state = chatViewReducer(state, {
      type: 'usage',
      usage: {
        inputTokens: 2,
        outputTokens: 2,
        totalTokens: 4,
        estimatedCostCny: '0.000012',
        usageUnknown: false,
      },
    })
    state = chatViewReducer(state, { type: 'complete' })

    assert.deepEqual(
      state.messages.map(({ role, content }) => ({ role, content })),
      [
        { role: 'user', content: '第一问' },
        { role: 'assistant', content: '第一答' },
        { role: 'user', content: '第二问' },
        { role: 'assistant', content: '第二答' },
      ],
    )
    assert.equal(state.messages[1]?.requestId, '00000000-0000-4000-8000-000000000001')
    assert.equal(state.messages[3]?.usage?.totalTokens, 4)
  })

  it('keeps partial content when a stream errors or is cancelled', () => {
    let state = chatViewReducer(initialChatViewState, { type: 'submit', prompt: '测试' })
    state = chatViewReducer(state, { type: 'delta', content: '部分内容' })
    const failed = chatViewReducer(state, { type: 'fail', message: '服务暂不可用' })
    assert.equal(failed.messages.at(-1)?.content, '部分内容')
    assert.equal(failed.messages.at(-1)?.error, '服务暂不可用')

    const cancelled = chatViewReducer(state, { type: 'cancel' })
    const lateDelta = chatViewReducer(cancelled, { type: 'delta', content: '不应追加' })
    assert.equal(lateDelta.messages.at(-1)?.content, '部分内容')
  })

  it('starts a clean conversation with reset message ids', () => {
    const state = chatViewReducer(initialChatViewState, { type: 'submit', prompt: '旧会话' })
    assert.deepEqual(chatViewReducer(state, { type: 'clear' }), initialChatViewState)
  })

  it('uses a safe fallback for unknown thrown values', () => {
    assert.equal(readableChatError(null), '暂时无法完成请求，请稍后重试。')
    assert.equal(readableChatError(new Error('网络连接失败')), '网络连接失败')
  })
})
