import { cn } from '../../lib/cn'

const skills = [
  { name: '深度研究', description: '拆解复杂问题，整理信息并形成结构化研究结论。', category: '研究', mark: 'DR', tone: 'violet' as const },
  { name: '代码解释', description: '阅读代码上下文，用清晰语言说明逻辑、依赖与风险。', category: '开发', mark: '</>', tone: 'blue' as const },
  { name: '内容润色', description: '调整表达、语气与结构，同时保留原始信息和意图。', category: '写作', mark: 'Aa', tone: 'coral' as const },
]

const markTone = {
  violet: 'bg-brand-muted text-[#5a43c5]',
  blue: 'bg-[#dfeaf9] text-[#315f9e]',
  coral: 'bg-[#fbe5df] text-[#b84d38]',
}

export default function SkillsPage() {
  return (
    <main className="mx-auto max-w-[72rem] px-5 py-12 md:px-14 md:py-24">
      <header className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[0.65rem] font-extrabold tracking-[0.16em] text-brand">INSTALLED CAPABILITIES</p>
          <h1 className="mt-3 text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] font-extrabold tracking-tight">已安装技能</h1>
          <p className="mt-5 max-w-[40rem] text-[0.95rem] leading-relaxed text-ink-muted">
            技能为 AI 增加专门的工作方法。当前页面展示界面预览，服务端接入将在后续开放。
          </p>
        </div>
        <span className="shrink-0 border-b border-line pb-2.5 pl-0 text-xs text-ink-faint md:pl-10">
          <strong className="mr-1 text-2xl text-ink dark:text-white">{skills.length}</strong> 项可用
        </span>
      </header>

      <section className="mt-12 flex items-start gap-3 rounded-2xl border border-line bg-surface-card/55 p-4 dark:bg-white/[0.025]" aria-label="功能状态">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-coral shadow-[0_0_0_4px_rgb(240_106_80/0.1)]" />
        <div>
          <strong className="text-[0.78rem]">展示模式</strong>
          <p className="mt-0.5 text-[0.73rem] text-ink-faint">技能暂时不会发起服务端请求，你可以先浏览已安装能力。</p>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="已安装技能列表">
        {skills.map((skill) => (
          <article
            key={skill.name}
            className="flex min-h-72 flex-col rounded-[1.25rem] border border-line bg-surface-card/72 p-5 shadow-[0_12px_30px_rgb(32_24_50/0.04)] transition-[transform,box-shadow,border-color] hover:-translate-y-1 hover:border-brand-muted hover:shadow-[0_18px_40px_rgb(32_24_50/0.09)] dark:bg-white/[0.035] dark:shadow-none"
          >
            <div className={cn('grid size-[3.2rem] place-items-center rounded-2xl font-mono text-[0.72rem] font-black', markTone[skill.tone])}>
              {skill.mark}
            </div>
            <div className="mt-9">
              <span className="font-mono text-[0.6rem] tracking-widest text-ink-subtle">{skill.category}</span>
              <h2 className="mt-2 text-xl tracking-tight">{skill.name}</h2>
              <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-muted">{skill.description}</p>
            </div>
            <div className="mt-8 flex items-center gap-1.5 text-[0.68rem] text-ink-muted">
              <span className="size-1.5 rounded-full bg-success" /> 已安装
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
