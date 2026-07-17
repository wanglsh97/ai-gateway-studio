'use client'

import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { AdminApiError } from '../../../../lib/admin-auth-client'
import {
  deleteAdminTableRow,
  loadAdminTableRows,
  loadAdminTables,
  updateAdminTableRow,
} from '../../../../lib/admin-tables'
import type {
  AdminTableCapability,
  AdminTableFieldCapability,
  AdminTablePage,
} from '../../../../lib/admin-tables'

type PendingAction =
  | { type: 'update'; row: Record<string, unknown>; patch: Record<string, unknown> }
  | { type: 'delete'; row: Record<string, unknown> }

export default function AdminDatabasePage() {
  const router = useRouter()
  const [tables, setTables] = useState<AdminTableCapability[]>([])
  const [tableName, setTableName] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<AdminTablePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [mutating, setMutating] = useState(false)
  const [revision, setRevision] = useState(0)
  const capability = useMemo(
    () => tables.find(({ name }) => name === tableName) ?? null,
    [tableName, tables],
  )

  useEffect(() => {
    let active = true
    void loadAdminTables()
      .then((loaded) => {
        if (!active) return
        setTables(loaded)
        const requestedTable = new URLSearchParams(window.location.search).get('table')
        const initialTable = loaded.some(({ name }) => name === requestedTable)
          ? requestedTable
          : loaded[0]?.name
        setTableName((current) => current || initialTable || '')
      })
      .catch((caught: unknown) => handleError(caught, router, setError))
    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    if (!tableName) return
    let active = true
    setLoading(true)
    setError('')
    void loadAdminTableRows(tableName, { page, pageSize: 20 })
      .then((loaded) => {
        if (active) setResult(loaded)
      })
      .catch((caught: unknown) => {
        if (active) handleError(caught, router, setError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [page, revision, router, tableName])

  function chooseTable(name: string) {
    setTableName(name)
    setPage(1)
    setEditing(null)
  }

  function beginEdit(row: Record<string, unknown>) {
    if (!capability) return
    setEditing(row)
    setForm(
      Object.fromEntries(
        capability.fields
          .filter(({ editable }) => editable)
          .map((field) => [field.name, editableValue(row[field.name], field)]),
      ),
    )
  }

  function prepareUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!capability || !editing) return
    try {
      const patch = Object.fromEntries(
        capability.fields
          .filter(({ editable }) => editable)
          .map((field) => [field.name, parseEditableValue(form[field.name] ?? '', field)]),
      )
      setError('')
      setPending({ type: 'update', row: editing, patch })
    } catch {
      setError('JSON 字段格式无效，请检查后重试')
    }
  }

  async function confirmMutation() {
    if (!pending || !capability) return
    const id = String(pending.row[capability.primaryKey])
    setMutating(true)
    setError('')
    try {
      if (pending.type === 'update') {
        await updateAdminTableRow(capability.name, id, pending.patch)
      } else {
        await deleteAdminTableRow(capability.name, id)
      }
      setPending(null)
      setEditing(null)
      setRevision((current) => current + 1)
    } catch (caught) {
      handleError(caught, router, setError)
      setPending(null)
    } finally {
      setMutating(false)
    }
  }

  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
          DATABASE
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">业务表管理</h1>
      </header>

      <section className="flex flex-wrap gap-2">
        {tables.map((table) => (
          <button
            key={table.name}
            type="button"
            onClick={() => chooseTable(table.name)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${table.name === tableName ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'border border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/5'}`}
          >
            {table.label}
          </button>
        ))}
      </section>

      {capability && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <div>
              <h2 className="font-semibold">{capability.label}</h2>
              <p className="mt-1 text-xs text-slate-400">
                权限：{capability.operations.join(' / ')}
              </p>
            </div>
            <span className="text-sm text-slate-500">共 {result?.total ?? 0} 条</span>
          </header>
          {loading ? (
            <p aria-busy="true" className="p-10 text-center text-slate-400">
              正在加载…
            </p>
          ) : error ? (
            <p role="alert" className="p-10 text-center text-rose-600">
              {error}
            </p>
          ) : !result || result.items.length === 0 ? (
            <p className="p-10 text-center text-slate-400">暂无数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-100/80 text-xs text-slate-500 dark:bg-white/5">
                  <tr>
                    {capability.fields.map((field) => (
                      <th key={field.name} className="px-4 py-3 font-medium">
                        {field.label}
                      </th>
                    ))}
                    <th className="sticky right-0 bg-slate-100 px-4 py-3 dark:bg-slate-900">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {result.items.map((row) => (
                    <tr key={String(row[capability.primaryKey])}>
                      {capability.fields.map((field) => (
                        <td
                          key={field.name}
                          className="max-w-64 truncate px-4 py-3"
                          title={displayValue(row[field.name])}
                        >
                          {displayValue(row[field.name])}
                        </td>
                      ))}
                      <td className="sticky right-0 whitespace-nowrap bg-white px-4 py-3 dark:bg-slate-950">
                        {capability.operations.includes('update') && (
                          <button
                            type="button"
                            onClick={() => beginEdit(row)}
                            className="mr-3 text-cyan-700 hover:underline dark:text-cyan-300"
                          >
                            编辑
                          </button>
                        )}
                        {capability.operations.includes('delete') && (
                          <button
                            type="button"
                            onClick={() => setPending({ type: 'delete', row })}
                            className="text-rose-600 hover:underline"
                          >
                            删除
                          </button>
                        )}
                        {!capability.operations.includes('update') &&
                          !capability.operations.includes('delete') && (
                            <span className="text-slate-400">只读</span>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result && result.total > 0 && (
            <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-white/10">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
              >
                上一页
              </button>
              <span>
                {page}/{Math.max(1, result.pageCount)}
              </span>
              <button
                disabled={page >= result.pageCount}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-white/10"
              >
                下一页
              </button>
            </footer>
          )}
        </section>
      )}

      {editing && capability && (
        <Modal title={`编辑 ${capability.label}`} onClose={() => setEditing(null)}>
          <form onSubmit={prepareUpdate} className="space-y-4">
            {capability.fields
              .filter(({ editable }) => editable)
              .map((field) => (
                <EditField
                  key={field.name}
                  field={field}
                  value={form[field.name] ?? ''}
                  onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
                />
              ))}
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-950 px-4 py-2.5 font-semibold text-white dark:bg-white dark:text-slate-950"
            >
              检查变更
            </button>
          </form>
        </Modal>
      )}

      {pending && capability && (
        <Modal
          title={pending.type === 'delete' ? '确认删除记录' : '确认提交编辑'}
          onClose={() => setPending(null)}
        >
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            即将{pending.type === 'delete' ? '删除' : '修改'} {capability.label} 中 ID 为{' '}
            <span className="break-all font-mono">
              {String(pending.row[capability.primaryKey])}
            </span>{' '}
            的记录。该操作会写入不可变审计日志。
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 dark:border-white/10"
            >
              取消
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={confirmMutation}
              className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {mutating ? '正在提交…' : '确认操作'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}

function EditField({
  field,
  value,
  onChange,
}: {
  field: AdminTableFieldCapability
  value: string
  onChange: (value: string) => void
}) {
  if (field.kind === 'boolean')
    return (
      <label className="block text-sm font-medium">
        {field.label}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-900"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </label>
    )
  return (
    <label className="block text-sm font-medium">
      {field.label}
      {field.nullable && <span className="ml-1 text-xs text-slate-400">可为空</span>}
      {field.kind === 'json' ? (
        <textarea
          rows={6}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs dark:border-white/10 dark:bg-slate-900"
        />
      ) : (
        <input
          type={field.kind === 'number' || field.kind === 'decimal' ? 'number' : 'text'}
          step={field.kind === 'decimal' ? '0.00000001' : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-900"
        />
      )}
    </label>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-5"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-950"
      >
        <header className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-white/10"
          >
            关闭
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function editableValue(value: unknown, field: AdminTableFieldCapability): string {
  if (value === null || value === undefined) return ''
  return field.kind === 'json' ? JSON.stringify(value, null, 2) : String(value)
}

function parseEditableValue(value: string, field: AdminTableFieldCapability): unknown {
  if (field.nullable && value.trim() === '') return null
  if (field.kind === 'number') return Number(value)
  if (field.kind === 'decimal') return value
  if (field.kind === 'boolean') return value === 'true'
  if (field.kind === 'json') return JSON.parse(value) as unknown
  return value
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function handleError(
  error: unknown,
  router: ReturnType<typeof useRouter>,
  setError: (message: string) => void,
) {
  if (error instanceof AdminApiError && error.status === 401) {
    router.replace('/admin/login')
    return
  }
  setError(error instanceof Error ? error.message : '数据库管理请求失败')
}
