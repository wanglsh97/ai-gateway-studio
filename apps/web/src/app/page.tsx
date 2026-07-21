import Link from 'next/link'

import { IntegrationGuide } from '../components/integration-guide'
import { cn } from '../lib/cn'

const capabilities = [
  {
    name: 'Chat',
    label: '实时对话',
    description: '流式回答、模型切换与多路对比，在一次对话里看清差异。',
    href: '/chat',
    tone: 'brand' as const,
    icon: '⌁',
  },
  {
    name: 'Image',
    label: '文生图',
    description: '写下画面，选择模型，持续追踪从生成到下载的完整过程。',
    href: '/image',
    tone: 'coral' as const,
    icon: '◇',
  },
  {
    name: 'Prompt',
    label: '提示词优化',
    description: '扩写、精简或结构化，让一个模糊念头变成可执行指令。',
    href: '/prompt',
    tone: 'cyan' as const,
    icon: '✦',
  },
]

const providers = ['Qwen', 'GLM', 'DeepSeek']

const focusRing =
  'focus-visible:outline-3 focus-visible:outline-brand focus-visible:outline-offset-4'

const capabilityTone = {
  brand: {
    icon: 'bg-brand-subtle text-brand dark:bg-[#30264f] dark:text-brand-light',
    name: 'text-brand',
  },
  coral: {
    icon: 'bg-[#fceae5] text-[#d6523b] dark:bg-[#492820] dark:text-coral-light',
    name: 'text-coral',
  },
  cyan: {
    icon: 'bg-[#e1f3ef] text-cyan dark:bg-[#173a34] dark:text-cyan-light',
    name: 'text-cyan dark:text-cyan-light',
  },
}

function RouteMap() {
  return (
    <div
      className="relative min-h-[33rem] overflow-hidden rounded-xl border border-console-border bg-console text-[#eaf0ff] shadow-[0_38px_90px_rgb(26_39_73/0.22)] max-sm:mx-[-0.25rem] max-sm:min-h-[29rem]"
      aria-label="请求经过统一网关分发至多个模型的示意图"
    >
      <div className="relative z-2 flex items-center justify-between border-b border-console-border px-4 py-4 font-mono text-[0.58rem] font-bold tracking-widest text-console-muted">
        <div className="flex items-center gap-2 text-[#c3b9d3]">
          <span className="size-1.5 animate-status-breathe rounded-full bg-mint shadow-[0_0_0_4px_rgb(83_214_189/0.1)]" />
          Gateway online
        </div>
        <span>CN / EAST-1</span>
      </div>

      <div className="relative z-1 grid min-h-[27rem] grid-cols-[1fr_7rem_1fr] grid-rows-[auto_1fr_auto] px-8 pt-12 pb-9 max-sm:min-h-[23rem] max-sm:grid-cols-[1fr_5rem_1fr] max-sm:px-4 max-sm:pt-8 max-sm:pb-5">
        <div className="relative z-2 col-start-1 row-start-1 w-52 max-w-full self-start rounded-md border border-[#44395f] bg-[#201a31] p-4 max-sm:w-32">
          <span className="mb-2.5 block font-mono text-[0.56rem] tracking-widest text-[#9387aa]">YOUR REQUEST</span>
          <strong className="text-[0.82rem] font-semibold">
            说出你的想法
            <span className="ml-1 inline-block h-3.5 w-px animate-caret-blink bg-brand align-[-0.18rem]" aria-hidden="true" />
          </strong>
        </div>

        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 41 20 H 50 V 32" fill="none" stroke="#493e61" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M 50 50 V 74 H 60" fill="none" stroke="#493e61" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M 60 62 V 86" fill="none" stroke="#493e61" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M 60 62 H 64" fill="none" stroke="#493e61" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M 60 74 H 64" fill="none" stroke="#493e61" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d="M 60 86 H 64" fill="none" stroke="#493e61" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle cx="41" cy="20" r="0.75" className="fill-brand drop-shadow-[0_0_2px_#9a86ff]" />
          <circle cx="64" cy="62" r="0.75" className="fill-mint drop-shadow-[0_0_2px_#53d6bd]" />
          <circle cx="64" cy="74" r="0.75" className="fill-coral drop-shadow-[0_0_2px_#ff896f]" />
          <circle cx="64" cy="86" r="0.75" className="fill-brand drop-shadow-[0_0_2px_#9a86ff]" />
        </svg>

        <div className="relative z-2 col-start-2 row-start-2 flex flex-col items-center justify-center gap-2 self-center justify-self-center text-[0.62rem] text-[#95a2bd]">
          <span className="grid size-[4.2rem] animate-gateway-float place-items-center rounded-[1.25rem] border border-brand-light bg-brand font-display text-lg text-white shadow-[0_0_0_8px_rgb(112_87_232/0.1),0_0_34px_rgb(112_87_232/0.34)] rotate-45">
            <b className="-rotate-45 font-black">AG</b>
          </span>
          <span>统一网关</span>
        </div>

        <div className="relative z-2 col-start-3 row-start-3 flex w-44 max-w-full flex-col gap-2.5 self-end justify-self-end max-sm:w-32">
          {providers.map((provider, index) => (
            <div
              key={provider}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-md border border-[#403654] bg-[rgb(32_26_49/0.92)] px-3 py-3 font-mono text-[0.65rem] text-[#dce4f5]"
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  index === 0 && 'bg-mint',
                  index === 1 && 'bg-coral',
                  index === 2 && 'bg-brand',
                )}
              />
              <span>{provider}</span>
              <small className="text-[0.54rem] text-[#9286a6]">{index === 0 ? '12ms' : index === 1 ? '18ms' : '24ms'}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-2 flex border-t border-console-border px-4 py-4 font-mono text-[0.58rem] font-bold tracking-widest text-console-muted max-sm:gap-2">
        <span className="before:text-brand before:content-['/ ']">统一协议</span>
        <span className="before:text-brand before:content-['/ ']">流式响应</span>
        <span className="before:text-brand before:content-['/ ']">费用可见</span>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <section className="relative mx-auto grid max-w-[80rem] min-h-[calc(100svh-72px)] grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-[0.94fr_1.06fr] lg:gap-28 lg:px-10 lg:py-32 xl:min-h-[calc(100svh-72px)] before:hidden lg:before:absolute lg:before:top-[10%] lg:before:left-[48%] lg:before:h-[80%] lg:before:w-px lg:before:bg-linear-to-b lg:before:from-transparent lg:before:via-line lg:before:to-transparent">
        <div className="max-w-[46rem]">
          <p className="flex items-center gap-3 font-mono text-[0.66rem] font-bold tracking-[0.14em] text-ink-muted uppercase">
            <span>AI 能力入口</span>
            <span className="h-px w-10 bg-line" />
            <span>稳定运行中</span>
          </p>
          <h1 className="mt-7 max-w-[46rem] font-display text-[clamp(3.55rem,6.8vw,6.75rem)] leading-[0.93] font-black tracking-[-0.075em] text-ink">
            一个入口，
            <br />
            <span className="text-brand">调动每一种</span> AI。
          </h1>
          <p className="mt-8 max-w-[37rem] text-[clamp(1rem,1.4vw,1.16rem)] leading-relaxed text-ink-muted">
            对话、图像与 Prompt 优化都从这里开始。你只需要描述目标，底层模型、流式传输和费用记录交给网关处理。
          </p>

          <div className="mt-9 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <Link
              href="/chat"
              className={cn(
                'inline-flex min-h-14 w-full items-center justify-between gap-10 rounded-md bg-ink px-5 py-0 text-sm font-bold text-surface shadow-[0_12px_30px_rgb(16_24_42/0.13)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_17px_36px_rgb(16_24_42/0.2)] sm:w-auto sm:justify-start sm:pr-2 sm:pl-6',
                focusRing,
              )}
            >
              <span>开始对话</span>
              <span className="grid size-10 place-items-center rounded-md bg-brand text-lg text-white" aria-hidden="true">
                ↗
              </span>
            </Link>
            <a href="#integration" className={cn('inline-flex items-center gap-2.5 text-sm font-bold text-ink hover:text-brand', focusRing)}>
              查看接入方式
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="mt-14 flex flex-wrap gap-x-5 gap-y-2.5 font-mono text-[0.65rem] tracking-wide text-ink-muted" aria-label="平台特点">
            {['3 个文本模型', '2 个图像模型', '人民币费用估算'].map((item) => (
              <span key={item} className="inline-flex items-center gap-2 before:size-[0.3rem] before:rounded-full before:bg-coral before:content-['']">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="max-w-[42rem] lg:max-w-none">
          <RouteMap />
          <p className="mt-4 text-right font-mono text-[0.63rem] text-ink-muted max-sm:text-left">
            一次请求，从统一入口抵达合适的模型。
          </p>
        </div>
      </section>

      <IntegrationGuide />

      <section id="capabilities" className="mx-auto max-w-[80rem] border-t border-line px-6 py-[7.5rem] lg:px-10">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[0.7fr_1.3fr_1fr]">
          <p className="font-mono text-[0.66rem] font-bold tracking-[0.14em] text-ink-muted uppercase">选择你的起点</p>
          <h2 className="-mt-1 font-display text-[clamp(2.1rem,4vw,3.8rem)] leading-tight tracking-tight text-ink">
            把想法交给合适的能力。
          </h2>
          <p className="max-w-[25rem] text-sm leading-relaxed text-ink-muted">
            三个入口共享同一套模型网关，每一个都为具体任务保留最顺手的交互。
          </p>
        </div>

        <div className="mt-16 overflow-hidden rounded-xl border border-line bg-line">
          <div className="grid grid-cols-1 gap-px lg:grid-cols-3">
            {capabilities.map((capability) => (
              <Link
                key={capability.name}
                href={capability.href}
                className={cn(
                  'flex min-h-96 flex-col justify-between bg-surface p-6 transition-[background,transform,box-shadow] hover:relative hover:z-1 hover:-translate-y-1 hover:bg-surface-card hover:shadow-[0_22px_45px_rgb(35_48_78/0.12)] dark:hover:bg-surface-muted',
                  focusRing,
                )}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={cn('grid size-12 place-items-center rounded-md text-2xl', capabilityTone[capability.tone].icon)}
                    aria-hidden="true"
                  >
                    {capability.icon}
                  </span>
                  <span className="text-xl text-ink-muted transition-[transform,color] group-hover:translate-x-0.5" aria-hidden="true">
                    ↗
                  </span>
                </div>
                <div>
                  <p className={cn('font-mono text-[0.62rem] font-extrabold tracking-widest uppercase', capabilityTone[capability.tone].name)}>
                    {capability.name}
                  </p>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-ink">{capability.label}</h3>
                  <p className="mt-4 max-w-72 text-[0.82rem] leading-relaxed text-ink-muted">{capability.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid place-items-center bg-brand px-6 py-[7.5rem] text-center text-white">
        <p className="m-0 font-display text-[clamp(2.3rem,5vw,5.4rem)] leading-tight font-black tracking-tight">不必理解每一家模型。</p>
        <p className="m-0 font-display text-[clamp(2.3rem,5vw,5.4rem)] leading-tight font-black tracking-tight text-[#d4ccff]">
          只需选择你想完成的事。
        </p>
        <Link
          href="/chat"
          className={cn(
            'mt-11 inline-flex items-center gap-8 border-b border-white/55 pb-1.5 text-sm font-bold',
            focusRing,
          )}
        >
          现在开始 <span aria-hidden="true">→</span>
        </Link>
      </section>

      <footer className="mx-auto flex max-w-[80rem] flex-col justify-between gap-2 px-6 py-8 font-mono text-[0.62rem] tracking-wide text-ink-muted sm:flex-row lg:px-10">
        <span>AI Gateway Studio</span>
        <span>One interface. Many intelligences.</span>
      </footer>
    </main>
  )
}
