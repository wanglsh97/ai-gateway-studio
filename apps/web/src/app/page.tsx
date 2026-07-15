import Link from 'next/link'

const capabilities = [
  {
    name: 'Chat',
    eyebrow: 'STREAM',
    description: '与统一文本模型实时对话，后续可并排比较多个模型的回答。',
    href: '/chat',
    accent: 'from-cyan-400 to-blue-500',
  },
  {
    name: '文生图',
    eyebrow: 'IMAGINE',
    description: '用自然语言提交图片任务，在一个页面追踪进度并获取结果。',
    href: '/image',
    accent: 'from-violet-400 to-fuchsia-500',
  },
  {
    name: 'Prompt 优化',
    eyebrow: 'REFINE',
    description: '围绕扩写、精简与结构化三种模式，快速打磨原始想法。',
    href: '/prompt',
    accent: 'from-amber-300 to-orange-500',
  },
]

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <section className="relative px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28 lg:px-10">
        <div className="hero-orb hero-orb-primary" aria-hidden="true" />
        <div className="hero-orb hero-orb-secondary" aria-hidden="true" />

        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgb(16_185_129_/_0.8)]" />
              统一模型能力 · 一个入口
            </p>
            <h1 className="mt-7 text-balance text-5xl font-semibold leading-[1.03] tracking-[-0.045em] text-slate-950 sm:text-7xl lg:text-[5.5rem] dark:text-white">
              把模型能力，变成
              <span className="title-gradient block">稳定的产品接口。</span>
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-base leading-8 text-slate-600 sm:text-lg dark:text-slate-300">
              在同一个站点体验对话、文生图与 Prompt
              优化。页面只面对统一网关，模型差异、调用记录与费用估算都留在服务端处理。
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/chat"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                开始体验 Chat
                <span
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
              <a
                href="#capabilities"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white/70 px-5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              >
                查看三项能力
              </a>
            </div>
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-slate-500 sm:mt-20 dark:text-slate-400">
            {['Web', '@aigateway/sdk', 'NestJS', 'Model Adapter'].map((item, index) => (
              <div key={item} className="contents">
                {index > 0 && (
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                    /
                  </span>
                )}
                <span className="rounded-md border border-slate-200/80 bg-white/60 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/5">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="capabilities"
        className="border-y border-slate-200/70 bg-white/55 px-5 py-20 backdrop-blur-sm sm:px-8 lg:px-10 dark:border-white/10 dark:bg-white/[0.025]"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
              EXPLORE
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
              三种能力，一套清晰体验
            </h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">
              每项能力共享模型网关和可观测链路，但保留适合各自任务的交互方式。
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {capabilities.map((capability, index) => (
              <Link
                key={capability.name}
                href={capability.href}
                className="capability-card group relative min-h-64 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-500 dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-white/20"
              >
                <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${capability.accent}`} />
                <div className="mt-8 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.68rem] font-bold tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {capability.eyebrow}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {capability.name}
                    </h3>
                  </div>
                  <span
                    className="text-4xl font-light text-slate-200 transition group-hover:translate-x-1 group-hover:text-slate-400 dark:text-slate-700 dark:group-hover:text-slate-500"
                    aria-hidden="true"
                  >
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-6 text-sm leading-7 text-slate-600 dark:text-slate-400">
                  {capability.description}
                </p>
                <span className="absolute bottom-6 left-6 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  进入体验 <span aria-hidden="true">↗</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-5 py-8 text-center text-xs text-slate-500 sm:px-8 dark:text-slate-500">
        AI Gateway Studio · 统一协议，独立模型，自由演进
      </footer>
    </main>
  )
}
