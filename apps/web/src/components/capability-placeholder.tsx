import Link from 'next/link'

interface CapabilityPlaceholderProps {
  title: string
  description: string
}

export function CapabilityPlaceholder({ title, description }: CapabilityPlaceholderProps) {
  return (
    <main className="px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200/80 bg-white/75 p-8 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-12 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
          COMING NEXT
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
          {title}
        </h1>
        <p className="mt-5 max-w-xl leading-8 text-slate-600 dark:text-slate-300">{description}</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          ← 返回首页
        </Link>
      </div>
    </main>
  )
}
