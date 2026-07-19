'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import {
  githubLoginUrl,
  sanitizeUserReturnTo,
  userLoginErrorMessage,
} from '../../lib/user-auth-client'

export function LoginContent() {
  const searchParams = useSearchParams()
  const [leaving, setLeaving] = useState(false)
  const returnTo = sanitizeUserReturnTo(searchParams.get('returnTo'))
  const errorMessage = userLoginErrorMessage(searchParams.get('error'))

  return (
    <main className="px-5 py-16 sm:px-8 sm:py-24 lg:px-10">
      <section className="mx-auto max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 p-7 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-10 dark:border-white/10 dark:bg-slate-950/75">
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
          USER SIGN IN
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">使用 GitHub 登录</h1>
        <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
          登录后即可使用 Chat、文生图和 Prompt 优化。本站不保存 GitHub 密码。
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
          {leaving ? '正在前往 GitHub…' : errorMessage ? '重新使用 GitHub 登录' : '使用 GitHub 登录'}
        </a>

        <p className="mt-5 text-xs leading-6 text-slate-500 dark:text-slate-400">
          GitHub 将提示授权读取公开资料和邮箱列表。邮箱不存在或未公开时仍可登录；本站只保存已验证的主邮箱。
        </p>
        <div className="mt-7 border-t border-slate-200 pt-5 text-center text-sm dark:border-white/10">
          <Link className="text-slate-600 underline-offset-4 hover:underline dark:text-slate-300" href="/">
            返回首页
          </Link>
        </div>
      </section>
    </main>
  )
}
