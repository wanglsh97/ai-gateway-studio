import { AdminApiError } from './admin-auth-client'

export type AdminFieldKind =
  'string' | 'number' | 'boolean' | 'decimal' | 'datetime' | 'json' | 'enum'
export type AdminTableOperation = 'query' | 'update' | 'delete'

export interface AdminTableFieldCapability {
  name: string
  label: string
  kind: AdminFieldKind
  nullable: boolean
  editable: boolean
}

export interface AdminTableCapability {
  name: string
  label: string
  primaryKey: string
  operations: AdminTableOperation[]
  fields: AdminTableFieldCapability[]
}

export interface AdminTablePage {
  items: Array<Record<string, unknown>>
  page: number
  pageSize: number
  total: number
  pageCount: number
}

export function loadAdminTables(fetchImplementation: typeof fetch = fetch) {
  return request<AdminTableCapability[]>(
    '/api/v1/admin/tables',
    { method: 'GET' },
    fetchImplementation,
  )
}

export function loadAdminTableRows(
  table: string,
  query: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
  fetchImplementation: typeof fetch = fetch,
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) search.set(key, String(value))
  }
  return request<AdminTablePage>(
    `/api/v1/admin/tables/${encodeURIComponent(table)}/rows?${search}`,
    { method: 'GET' },
    fetchImplementation,
  )
}

export function updateAdminTableRow(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  fetchImplementation: typeof fetch = fetch,
) {
  return request<Record<string, unknown>>(
    `/api/v1/admin/tables/${encodeURIComponent(table)}/rows/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
      headers: { 'content-type': 'application/json' },
    },
    fetchImplementation,
  )
}

export function deleteAdminTableRow(
  table: string,
  id: string,
  fetchImplementation: typeof fetch = fetch,
) {
  return request<{ deleted: true; id: string }>(
    `/api/v1/admin/tables/${encodeURIComponent(table)}/rows/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    fetchImplementation,
  )
}

async function request<T>(
  url: string,
  init: RequestInit,
  fetchImplementation: typeof fetch,
): Promise<T> {
  const response = await fetchImplementation(url, {
    ...init,
    credentials: 'same-origin',
    headers: { accept: 'application/json', ...init.headers },
  })
  if (!response.ok) {
    let message = '数据库管理请求失败'
    try {
      const body = (await response.json()) as { message?: unknown }
      if (typeof body.message === 'string') message = body.message
    } catch {
      // Preserve the stable fallback for non-JSON errors.
    }
    throw new AdminApiError(response.status, message)
  }
  return (await response.json()) as T
}
