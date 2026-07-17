import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ImageHistoryEntry } from './image-history'
import { IMAGE_HISTORY_TTL_MS, readImageHistory, upsertImageHistory } from './image-history'

const now = Date.parse('2026-07-17T00:00:00.000Z')

describe('image history', () => {
  it('tolerates corrupt, missing and expired localStorage data', () => {
    assert.deepEqual(readImageHistory('{broken', now), [])
    assert.deepEqual(readImageHistory(JSON.stringify([{ prompt: 'missing task' }]), now), [])
    assert.deepEqual(
      readImageHistory(
        JSON.stringify([entry('old', new Date(now - IMAGE_HISTORY_TTL_MS - 1).toISOString())]),
        now,
      ),
      [],
    )
  })

  it('deduplicates by task ID and keeps the newest five records', () => {
    let history: ImageHistoryEntry[] = [
      entry('same'),
      ...Array.from({ length: 5 }, (_, index) => entry(String(index))),
    ]
    history = upsertImageHistory(history, entry('same', new Date(now + 1).toISOString()))
    assert.equal(history.length, 5)
    assert.equal(history[0]?.task.taskId, 'same')
    assert.equal(history.filter(({ task }) => task.taskId === 'same').length, 1)
  })
})

function entry(taskId: string, savedAt = new Date(now).toISOString()) {
  return {
    prompt: `prompt-${taskId}`,
    savedAt,
    task: { taskId, model: 'wanxiang' as const, status: 'succeeded' as const, results: [] },
  }
}
