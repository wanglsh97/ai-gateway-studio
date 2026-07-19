'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  githubLoginUrl,
  sanitizeUserReturnTo,
  userLoginErrorMessage,
} from '../../lib/user-auth-client'
import { useUserSession } from '../../components/user-session-provider'

export function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const session = useUserSession()
  const [leaving, setLeaving] = useState(false)
  const returnTo = sanitizeUserReturnTo(searchParams.get('returnTo'))
  const errorMessage = userLoginErrorMessage(searchParams.get('error'))

  useEffect(() => {
    if (session.status === 'authenticated') router.replace(returnTo)
  }, [returnTo, router, session.status])

  return (
    <main className="px-5 py-16 sm:px-8 sm:py-24 lg:px-10">
      <section className="mx-auto max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-10 dark:border-white/10 dark:bg-slate-950/75">
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
          USER SIGN IN
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">使用 GitHub 登录</h1>
        <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
          登录后即可免费使用
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700 dark:border-rose-400/20 dark:bg-rose-950/25 dark:text-rose-200"
          >
            {errorMessage}
          </div>
        )}

        <a
          href={githubLoginUrl(returnTo)}
          aria-disabled={leaving}
          onClick={() => setLeaving(true)}
          className={`mt-7 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 ${leaving ? 'pointer-events-none opacity-60' : ''}`}
        >
          <span aria-hidden="true" className="text-lg">
            ◉
          </span>
          {leaving
            ? '正在前往 GitHub…'
            : errorMessage
              ? '重新使用 GitHub 登录'
              : '使用 GitHub 登录'}
        </a>

        <div className="mt-7 border-t border-slate-200 pt-5 text-center text-sm dark:border-white/10">
          <Link
            className="text-slate-600 underline-offset-4 hover:underline dark:text-slate-300"
            href="/"
          >
            返回首页
          </Link>
        </div>
      </section>
    </main>
  )
}
