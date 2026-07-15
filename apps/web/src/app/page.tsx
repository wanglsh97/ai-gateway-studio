const capabilities = [
  { name: 'Chat', description: '统一文本模型流式对话与多模型对比' },
  { name: '文生图', description: '提交、轮询并下载图片生成结果' },
  { name: 'Prompt 优化', description: '扩写、精简和结构化原始 Prompt' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-sky-700 dark:text-sky-300">
          AI GATEWAY STUDIO
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          工程骨架已就绪，下一步串通 Mock Chat 主链路。
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
          用户端将通过单一的 @aigateway/sdk 调用统一网关；模型厂商差异、日志和计费均由服务端处理。
        </p>

        <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="平台能力">
          {capabilities.map((capability) => (
            <article
              key={capability.name}
              className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
            >
              <h2 className="text-lg font-semibold">{capability.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {capability.description}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
