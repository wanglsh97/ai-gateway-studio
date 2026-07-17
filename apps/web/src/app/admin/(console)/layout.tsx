'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { AdminApiError, getAdminSession, logoutAdmin } from '../../../lib/admin-auth-client'
import type { AdminSession } from '../../../lib/admin-auth-client'

export default function AdminConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void getAdminSession()
      .then((restored) => {
        if (active) setSession(restored)
      })
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof AdminApiError && caught.status === 401) {
          router.replace('/admin/login')
          return
        }
        setError(caught instanceof Error ? caught.message : '会话恢复失败')
      })
    return () => {
      active = false
    }
  }, [router])

  async function logout() {
    try {
      await logoutAdmin()
    } finally {
      router.replace('/admin/login')
      router.refresh()
    }
  }

  if (error) {
    return <main className="mx-auto max-w-3xl px-5 py-16 text-center text-rose-700">{error}</main>
  }
  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center text-slate-500">
        正在恢复管理员会话…
      </main>
    )
  }

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-5 py-8 sm:px-8 lg:px-10">
      <aside className="w-52 shrink-0 rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="px-2 text-xs font-bold tracking-widest text-slate-400">ADMIN</p>
        <nav className="mt-4 space-y-1" aria-label="管理后台导航">
          <Link
            className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10"
            href="/admin"
          >
            Dashboard
          </Link>
          <Link
            className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/10"
            href="/admin/logs"
          >
            请求日志
          </Link>
        </nav>
        <button
          type="button"
          onClick={logout}
          className="mt-8 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10"
        >
          退出登录
        </button>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
