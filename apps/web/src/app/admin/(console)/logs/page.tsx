'use client'

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AdminApiError } from '../../../../lib/admin-auth-client'
import { loadRequestLogDetail, loadRequestLogs } from '../../../../lib/admin-request-logs'
import type {
  RequestLogDetail,
  RequestLogFilters,
  RequestLogPage,
} from '../../../../lib/admin-request-logs'

const initialFilters: RequestLogFilters = { page: 1, pageSize: 20 }

export default function AdminRequestLogsPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<RequestLogFilters>(initialFilters)
  const [filters, setFilters] = useState<RequestLogFilters>(initialFilters)
  const [result, setResult] = useState<RequestLogPage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<RequestLogDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void loadRequestLogs(filters)
      .then((page) => {
        if (active) setResult(page)
      })
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof AdminApiError && caught.status === 401) {
          router.replace('/admin/login')
          return
        }
        setError(caught instanceof Error ? caught.message : '请求日志加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [filters, router])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters({ ...draft, page: 1 })
  }

  function update(name: keyof RequestLogFilters, value: string) {
    setDraft((current) => ({ ...current, [name]: value }))
  }

  function goTo(page: number) {
    setDraft((current) => ({ ...current, page }))
    setFilters((current) => ({ ...current, page }))
  }

  async function openDetail(requestId: string) {
    setDetailLoading(true)
    setDetailError('')
    try {
      setDetail(await loadRequestLogDetail(requestId))
    } catch (caught) {
      if (caught instanceof AdminApiError && caught.status === 401) {
        router.replace('/admin/login')
        return
      }
      setDetailError(caught instanceof Error ? caught.message : '详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
          REQUEST LOGS
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">请求日志</h1>
      </header>

      <form
        onSubmit={submit}
        className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 md:grid-cols-4 dark:border-white/10 dark:bg-white/5"
      >
        <FilterSelect
          label="能力"
          value={draft.capability ?? ''}
          onChange={(value) => update('capability', value)}
          options={[
            ['chat', 'Chat'],
            ['image', '文生图'],
            ['prompt', 'Prompt'],
          ]}
        />
        <FilterSelect
          label="状态"
          value={draft.status ?? ''}
          onChange={(value) => update('status', value)}
          options={[
            ['pending', 'Pending'],
            ['succeeded', 'Succeeded'],
            ['failed', 'Failed'],
            ['cancelled', 'Cancelled'],
          ]}
        />
        <FilterSelect
          label="模型"
          value={draft.model ?? ''}
          onChange={(value) => update('model', value)}
          options={['qwen', 'glm', 'deepseek', 'kimi', 'wanxiang', 'cogview'].map((model) => [
            model,
            model,
          ])}
        />
        <label className="text-xs font-medium text-slate-500">
          Request ID
          <input
            value={draft.requestId ?? ''}
            onChange={(event) => update('requestId', event.target.value)}
            placeholder="UUID"
            className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          开始时间
          <input
            type="datetime-local"
            value={toLocalDateTimeValue(draft.from)}
            onChange={(event) =>
              update('from', event.target.value ? new Date(event.target.value).toISOString() : '')
            }
            className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          结束时间
          <input
            type="datetime-local"
            value={toLocalDateTimeValue(draft.to)}
            onChange={(event) =>
              update('to', event.target.value ? new Date(event.target.value).toISOString() : '')
            }
            className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
          />
        </label>
        <div className="flex items-end gap-2 md:col-span-2">
          <button
            type="submit"
            className="min-h-10 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
          >
            筛选
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(initialFilters)
              setFilters(initialFilters)
            }}
            className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm dark:border-white/10"
          >
            重置
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5">
        {loading ? (
          <p aria-busy="true" className="p-8 text-center text-slate-400">
            正在加载请求日志…
          </p>
        ) : error ? (
          <p role="alert" className="p-8 text-center text-rose-600">
            {error}
          </p>
        ) : !result || result.items.length === 0 ? (
          <p className="p-8 text-center text-slate-400">暂无匹配记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-100/80 text-xs text-slate-500 dark:bg-white/5">
                <tr>
                  {['时间', 'Request ID', '能力', '模型', '状态', '耗时', 'Token', '费用'].map(
                    (label) => (
                      <th key={label} className="px-4 py-3 font-medium">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {result.items.map((item) => (
                  <tr key={item.requestId}>
                    <td className="whitespace-nowrap px-4 py-3">
                      {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDetail(item.requestId)}
                        className="font-mono text-xs text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                      >
                        {item.requestId}
                      </button>
                    </td>
                    <td className="px-4 py-3">{item.capability}</td>
                    <td className="px-4 py-3">{item.modelAlias}</td>
                    <td className="px-4 py-3">{item.status}</td>
                    <td className="px-4 py-3">
                      {item.durationMs === null ? '—' : `${item.durationMs} ms`}
                    </td>
                    <td className="px-4 py-3">{item.billing?.totalTokens ?? '—'}</td>
                    <td className="px-4 py-3">
                      {item.billing?.estimatedCostCny ? `¥${item.billing.estimatedCostCny}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && result.total > 0 && (
          <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-white/10">
            <span>共 {result.total} 条</span>
            <div className="flex items-center gap-2">
              <button
                disabled={result.page <= 1 || loading}
                onClick={() => goTo(result.page - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
              >
                上一页
              </button>
              <span>
                {result.page}/{Math.max(1, result.pageCount)}
              </span>
              <button
                disabled={result.page >= result.pageCount || loading}
                onClick={() => goTo(result.page + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
              >
                下一页
              </button>
            </div>
          </footer>
        )}
      </section>
      {(detailLoading || detailError || detail) && (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDetail(null)
              setDetailError('')
            }
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="请求日志详情"
            className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-950 sm:p-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">请求详情</h2>
              <button
                type="button"
                onClick={() => {
                  setDetail(null)
                  setDetailError('')
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-white/10"
              >
                关闭
              </button>
            </div>
            {detailLoading ? (
              <p aria-busy="true" className="py-16 text-center text-slate-400">
                正在加载详情…
              </p>
            ) : detailError ? (
              <p
                role="alert"
                className="mt-6 rounded-xl bg-rose-50 p-4 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
              >
                {detailError}
              </p>
            ) : (
              detail && <DetailContent detail={detail} />
            )}
          </aside>
        </div>
      )}
    </main>
  )
}

function DetailContent({ detail }: { detail: RequestLogDetail }) {
  return (
    <div className="mt-6 space-y-6 text-sm">
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          ['Request ID', detail.requestId],
          ['状态', detail.status],
          ['能力', detail.capability],
          ['模型 alias', detail.modelAlias],
          ['Provider', detail.provider],
          ['Resolved model', detail.resolvedModel],
          ['Provider request ID', detail.providerRequestId],
          ['耗时', detail.durationMs === null ? null : `${detail.durationMs} ms`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-1 break-all font-medium">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <JsonSection title="完整 Prompt / Messages" value={detail.prompt} />
      <JsonSection title="Usage / Cost" value={detail.billing} />
      <JsonSection
        title="Failover"
        value={{ from: detail.failoverFrom, to: detail.failoverTo, reason: detail.failoverReason }}
      />
      <JsonSection
        title="完整错误"
        value={{
          code: detail.errorCode,
          message: detail.errorMessage,
          details: detail.errorDetails,
        }}
      />
      {detail.imageTask && <JsonSection title="图片任务" value={detail.imageTask} />}
      <JsonSection title="Metadata" value={detail.metadata} />
    </div>
  )
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  return (
    <section>
      <h3 className="font-semibold">{title}</h3>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-slate-100 p-4 text-xs leading-6 dark:bg-white/5">
        {JSON.stringify(value, null, 2) ?? 'null'}
      </pre>
    </section>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[][]
}) {
  return (
    <label className="text-xs font-medium text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
      >
        <option value="">全部</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}

function toLocalDateTimeValue(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
