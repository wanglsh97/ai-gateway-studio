import { AdminApiError } from './admin-auth-client'

export interface RequestLogFilters {
  page?: number
  pageSize?: number
  from?: string
  to?: string
  capability?: string
  model?: string
  status?: string
  requestId?: string
}

export interface RequestLogListItem {
  requestId: string
  capability: string
  modelAlias: string
  provider: string | null
  status: string
  stream: boolean
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  errorCode: string | null
  createdAt: string
  billing: {
    inputTokens: number | null
    outputTokens: number | null
    totalTokens: number | null
    usageUnknown: boolean
    estimatedCostCny: string | null
  } | null
}

export interface RequestLogPage {
  items: RequestLogListItem[]
  page: number
  pageSize: number
  total: number
  pageCount: number
}

export async function loadRequestLogs(
  filters: RequestLogFilters,
  fetchImplementation: typeof fetch = fetch,
): Promise<RequestLogPage> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const response = await fetchImplementation(`/api/v1/admin/logs?${search}`, {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (!response.ok) {
    let message = '请求日志加载失败'
    try {
      const body = (await response.json()) as { message?: unknown }
      if (typeof body.message === 'string') message = body.message
    } catch {
      // Keep a stable fallback for non-JSON failures.
    }
    throw new AdminApiError(response.status, message)
  }
  return (await response.json()) as RequestLogPage
}
