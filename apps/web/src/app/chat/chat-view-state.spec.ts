import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { chatViewReducer, initialChatViewState, readableChatError } from './chat-view-state'

describe('chatViewReducer', () => {
  it('moves from loading to incremental content and success', () => {
    const loading = chatViewReducer(initialChatViewState, {
      type: 'submit',
      prompt: '你好',
    })
    const firstDelta = chatViewReducer(loading, { type: 'delta', content: '你' })
    const secondDelta = chatViewReducer(firstDelta, { type: 'delta', content: '好' })
    const completed = chatViewReducer(secondDelta, { type: 'complete' })

    assert.deepEqual(completed, {
      status: 'success',
      prompt: '你好',
      response: '你好',
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

  it('uses a safe fallback for unknown thrown values', () => {
    assert.equal(readableChatError(null), '暂时无法完成请求，请稍后重试。')
    assert.equal(readableChatError(new Error('网络连接失败')), '网络连接失败')
  })
})
