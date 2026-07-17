import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AdminApiError } from './admin-auth-client'
import { loadRequestLogs } from './admin-request-logs'

describe('loadRequestLogs', () => {
  it('serializes non-empty filters and uses same-origin credentials', async () => {
    let call: { url: string; init?: RequestInit } | undefined
    await loadRequestLogs(
      { page: 2, pageSize: 25, status: 'failed', model: '' },
      async (input, init) => {
        call = { url: String(input), ...(init === undefined ? {} : { init }) }
        return Response.json({ items: [], page: 2, pageSize: 25, total: 0, pageCount: 0 })
      },
    )

    assert.equal(call?.url, '/api/v1/admin/logs?page=2&pageSize=25&status=failed')
    assert.equal(call?.init?.credentials, 'same-origin')
  })

  it('returns typed unauthorized errors for layout redirection', async () => {
    await assert.rejects(
      () => loadRequestLogs({}, async () => Response.json({}, { status: 401 })),
      (error: unknown) => error instanceof AdminApiError && error.status === 401,
    )
  })
})
