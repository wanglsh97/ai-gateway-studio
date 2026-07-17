'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type { ImageModelAlias, ModelSummary } from '@aigateway/sdk'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { enabledImageModels, IMAGE_SIZE_OPTIONS, maxImageCount } from './image-form'

const client = createAIGatewayClient()
const examples = ['雨后江南古镇，水墨画风格', 'A tiny astronaut tending flowers on Mars']

export default function ImagePage() {
  const [models, setModels] = useState<ModelSummary[]>([])
  const [model, setModel] = useState<ImageModelAlias>('wanxiang')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState(IMAGE_SIZE_OPTIONS.wanxiang[0]!.value)
  const [count, setCount] = useState(1)
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelError, setModelError] = useState('')

  useEffect(() => {
    let active = true
    void client.models
      .list()
      .then((summaries) => {
        if (!active) return
        const enabled = enabledImageModels(summaries)
        setModels(enabled)
        const first = enabled[0]
        if (first && (first.alias === 'wanxiang' || first.alias === 'cogview')) {
          setModel(first.alias)
          setSize(IMAGE_SIZE_OPTIONS[first.alias][0]!.value)
        }
      })
      .catch(() => {
        if (active) setModelError('图片模型加载失败，请稍后刷新')
      })
      .finally(() => {
        if (active) setLoadingModels(false)
      })
    return () => {
      active = false
    }
  }, [])

  function changeModel(next: ImageModelAlias) {
    setModel(next)
    setSize(IMAGE_SIZE_OPTIONS[next][0]!.value)
    setCount((current) => Math.min(current, maxImageCount(next)))
  }

  const available = models.length > 0

  return (
    <main className="px-5 py-8 sm:px-8 sm:py-12 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="text-xs font-bold tracking-[0.2em] text-violet-700 dark:text-violet-300">
            IMAGE GENERATION
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">文生图</h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
            用中文或英文描述画面，选择已启用模型和受支持的生成参数。
          </p>
        </header>

        <section className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <form
            onSubmit={(event) => event.preventDefault()}
            className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-xl shadow-slate-900/5 sm:p-7 dark:border-white/10 dark:bg-white/5"
          >
            <label className="block text-sm font-semibold" htmlFor="image-prompt">
              Prompt
            </label>
            <textarea
              id="image-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={4000}
              rows={8}
              placeholder="描述主体、环境、构图、光线和风格…"
              className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-transparent p-4 text-sm leading-7 outline-none focus:border-violet-400 dark:border-white/10"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="rounded-full border border-slate-200 px-3 py-2 text-left text-xs dark:border-white/10"
                >
                  {example}
                </button>
              ))}
            </div>

            {modelError && (
              <p role="alert" className="mt-4 text-sm text-rose-600">
                {modelError}
              </p>
            )}
            {!loadingModels && !modelError && !available && (
              <p role="status" className="mt-4 text-sm text-amber-700 dark:text-amber-300">
                当前没有已启用的图片模型。
              </p>
            )}

            <button
              type="submit"
              disabled={!prompt.trim() || !available}
              className="mt-6 min-h-11 w-full rounded-xl bg-slate-950 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950"
            >
              {loadingModels ? '加载模型中…' : '生成图片'}
            </button>
            <p className="mt-3 text-xs text-slate-400">任务提交与轮询将在下一功能点接入。</p>
          </form>

          <aside className="h-fit rounded-3xl border border-slate-200/80 bg-white/70 p-5 sm:p-6 dark:border-white/10 dark:bg-white/5">
            <h2 className="font-semibold">生成设置</h2>
            <div className="mt-5 space-y-5">
              <Field label="模型">
                <select
                  value={model}
                  disabled={!available}
                  onChange={(event) => changeModel(event.target.value as ImageModelAlias)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-900"
                >
                  {models.map((item) => (
                    <option key={item.alias} value={item.alias}>
                      {item.displayName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="图片尺寸">
                <select
                  value={size}
                  disabled={!available}
                  onChange={(event) => setSize(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-900"
                >
                  {IMAGE_SIZE_OPTIONS[model].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="生成数量">
                <select
                  value={count}
                  disabled={!available}
                  onChange={(event) => setCount(Number(event.target.value))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-900"
                >
                  {Array.from({ length: maxImageCount(model) }, (_, index) => index + 1).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value} 张
                      </option>
                    ),
                  )}
                </select>
              </Field>
            </div>
            <p className="mt-6 rounded-2xl bg-violet-50 p-4 text-xs leading-6 text-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
              V1 用于技术流程验证，正式公开真实文生图前仍需补充独立的输入与图片内容审核。
            </p>
          </aside>
        </section>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      {children}
    </label>
  )
}
