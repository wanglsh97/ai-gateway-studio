import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  deleteAdminTableRow,
  loadAdminTableRows,
  loadAdminTables,
  updateAdminTableRow,
} from './admin-tables'

describe('admin table client', () => {
  it('loads capabilities and encoded paginated rows with same-origin credentials', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImplementation: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), ...(init === undefined ? {} : { init }) })
      return Response.json([])
    }

    await loadAdminTables(fetchImplementation)
    await loadAdminTableRows('request/logs', { page: 2, pageSize: 20 }, fetchImplementation)

    assert.equal(calls[0]?.url, '/api/v1/admin/tables')
    assert.equal(calls[1]?.url, '/api/v1/admin/tables/request%2Flogs/rows?page=2&pageSize=20')
    assert.ok(calls.every(({ init }) => init?.credentials === 'same-origin'))
  })

  it('uses explicit PATCH and DELETE requests for allowlisted rows', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImplementation: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), ...(init === undefined ? {} : { init }) })
      return Response.json({ id: 'row/id', deleted: true })
    }

    await updateAdminTableRow('billing-records', 'row/id', { inputTokens: 2 }, fetchImplementation)
    await deleteAdminTableRow('billing-records', 'row/id', fetchImplementation)

    assert.equal(calls[0]?.init?.method, 'PATCH')
    assert.equal(calls[0]?.init?.body, JSON.stringify({ inputTokens: 2 }))
    assert.equal(calls[1]?.init?.method, 'DELETE')
    assert.ok(calls.every(({ url }) => url.endsWith('/row%2Fid')))
  })
})
