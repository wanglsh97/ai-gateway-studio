'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { loginAdmin } from '../../../lib/admin-auth-client'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('root')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await loginAdmin(username, password)
      router.replace('/admin')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-5rem)] place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/85 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-9 dark:border-white/10 dark:bg-slate-950/80">
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
          ADMIN CONSOLE
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          管理员登录
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          V1 固定账号仅用于开发联调，禁止直接用于不受控公网。
        </p>

        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            用户名
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            密码
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-900"
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 w-full rounded-xl bg-slate-950 px-4 font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
          >
            {submitting ? '正在登录…' : '登录'}
          </button>
        </form>
      </section>
    </main>
  )
}
