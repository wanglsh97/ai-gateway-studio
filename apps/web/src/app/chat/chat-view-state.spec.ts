import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { chatViewReducer, initialChatViewState, readableChatError } from './chat-view-state'

describe('chatViewReducer', () => {
  it('moves from loading to incremental content and success', () => {
    const loading = chatViewReducer(initialChatViewState, {
      type: 'submit',
      prompt: '你好',
    })
    const started = chatViewReducer(loading, {
      type: 'started',
      requestId: '00000000-0000-4000-8000-000000000001',
      model: 'qwen',
    })
    const firstDelta = chatViewReducer(started, { type: 'delta', content: '你' })
    const secondDelta = chatViewReducer(firstDelta, { type: 'delta', content: '好' })
    const withUsage = chatViewReducer(secondDelta, {
      type: 'usage',
      usage: {
        inputTokens: 2,
        outputTokens: 2,
        totalTokens: 4,
        estimatedCostCny: '0.000012',
        usageUnknown: false,
      },
    })
    const completed = chatViewReducer(withUsage, { type: 'complete' })

    assert.deepEqual(completed, {
      status: 'success',
      prompt: '你好',
      response: '你好',
      requestId: '00000000-0000-4000-8000-000000000001',
      model: 'qwen',
      usage: {
        inputTokens: 2,
        outputTokens: 2,
        totalTokens: 4,
        estimatedCostCny: '0.000012',
        usageUnknown: false,
      },
    })
  })

  it('keeps partial content when a stream reports an error', () => {
    const loading = chatViewReducer(initialChatViewState, {
      type: 'submit',
      prompt: '测试错误',
    })
    const streaming = chatViewReducer(loading, { type: 'delta', content: '部分内容' })
    const failed = chatViewReducer(streaming, { type: 'fail', message: '服务暂不可用' })

    assert.equal(failed.status, 'error')
    assert.equal(failed.response, '部分内容')
    assert.equal(failed.error, '服务暂不可用')
  })

  it('stops accepting deltas after cancellation and can clear the conversation', () => {
    const loading = chatViewReducer(initialChatViewState, {
      type: 'submit',
      prompt: '停止测试',
    })
    const streaming = chatViewReducer(loading, { type: 'delta', content: '已收到' })
    const cancelled = chatViewReducer(streaming, { type: 'cancel' })
    const lateDelta = chatViewReducer(cancelled, { type: 'delta', content: '不应追加' })

    assert.equal(lateDelta.status, 'cancelled')
    assert.equal(lateDelta.response, '已收到')
    assert.deepEqual(chatViewReducer(lateDelta, { type: 'clear' }), initialChatViewState)
  })

  it('uses a safe fallback for unknown thrown values', () => {
    assert.equal(readableChatError(null), '暂时无法完成请求，请稍后重试。')
    assert.equal(readableChatError(new Error('网络连接失败')), '网络连接失败')
  })
})
