export default function AdminHomePage() {
  return (
    <main className="rounded-3xl border border-slate-200/80 bg-white/80 p-7 shadow-sm dark:border-white/10 dark:bg-white/5">
      <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
        DASHBOARD
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">管理后台</h1>
      <p className="mt-3 text-slate-500 dark:text-slate-400">
        管理员会话已恢复。Dashboard 数据将在后续任务接入。
      </p>
    </main>
  )
}
