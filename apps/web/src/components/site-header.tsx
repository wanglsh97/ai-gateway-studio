import Link from 'next/link'

import { ThemeToggle } from './theme-toggle'

const navigation = [
  { href: '/chat', label: 'Chat' },
  { href: '/image', label: '文生图' },
  { href: '/prompt', label: 'Prompt 优化' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-slate-50/80 px-5 py-3 backdrop-blur-xl sm:px-8 lg:px-10 dark:border-white/10 dark:bg-[#060914]/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 rounded-md font-semibold tracking-tight text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-500 dark:text-white"
          aria-label="AI Gateway Studio 首页"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-xs font-bold text-white shadow-sm dark:bg-white dark:text-slate-950">
            AG
          </span>
          <span className="hidden min-[420px]:inline">AI Gateway Studio</span>
          <span className="min-[420px]:hidden">AI Gateway</span>
        </Link>

        <ThemeToggle />

        <nav
          className="order-3 mt-3 grid w-full grid-cols-3 rounded-xl border border-slate-200/80 bg-white/60 p-1 text-center text-xs font-medium text-slate-600 shadow-sm sm:order-none sm:mt-0 sm:flex sm:w-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          aria-label="主要导航"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-cyan-500 sm:px-3.5 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
