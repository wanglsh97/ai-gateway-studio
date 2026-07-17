import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { compareReducer, initialCompareState } from './compare-state'

describe('compareReducer', () => {
  it('keeps content, usage, errors and completion independent per model', () => {
    let state = compareReducer(initialCompareState, { type: 'start', models: ['qwen', 'glm'] })
    state = compareReducer(state, {
      type: 'event',
      model: 'qwen',
      event: { type: 'delta', requestId: 'qwen-id', content: 'Qwen' },
    })
    state = compareReducer(state, { type: 'fail', model: 'glm', message: 'GLM failed' })
    state = compareReducer(state, {
      type: 'event',
      model: 'qwen',
      event: {
        type: 'usage',
        requestId: 'qwen-id',
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          estimatedCostCny: '0.1',
          usageUnknown: false,
        },
      },
    })
    state = compareReducer(state, {
      type: 'event',
      model: 'qwen',
      event: { type: 'done', requestId: 'qwen-id' },
    })

    assert.deepEqual(
      state.columns.map(({ model, status, content, error }) => ({ model, status, content, error })),
      [
        { model: 'qwen', status: 'success', content: 'Qwen', error: undefined },
        { model: 'glm', status: 'error', content: '', error: 'GLM failed' },
      ],
    )
    assert.equal(state.columns[0]?.usage?.estimatedCostCny, '0.1')
    assert.equal(state.active, false)
  })

  it('cancels one column or all active columns without changing settled columns', () => {
    let state = compareReducer(initialCompareState, {
      type: 'start',
      models: ['qwen', 'glm', 'deepseek'],
    })
    state = compareReducer(state, { type: 'cancel', model: 'qwen' })
    assert.equal(state.columns[0]?.status, 'cancelled')
    assert.equal(state.columns[1]?.status, 'loading')
    state = compareReducer(state, { type: 'fail', model: 'glm', message: 'failed' })
    state = compareReducer(state, { type: 'cancelAll' })
    assert.deepEqual(
      state.columns.map(({ status }) => status),
      ['cancelled', 'error', 'cancelled'],
    )
  })
})
