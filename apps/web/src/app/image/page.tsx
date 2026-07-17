'use client'

import { AIGatewayTimeoutError, createAIGatewayClient } from '@aigateway/sdk'
import type { ImageModelAlias, ImageTask, ModelSummary } from '@aigateway/sdk'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import {
  createImageRequest,
  enabledImageModels,
  IMAGE_SIZE_OPTIONS,
  imageResultItems,
  maxImageCount,
} from './image-form'
import {
  IMAGE_HISTORY_KEY,
  type ImageHistoryEntry,
  readImageHistory,
  upsertImageHistory,
} from './image-history'

const client = createAIGatewayClient()
const examples = ['雨后江南古镇，水墨画风格', 'A tiny astronaut tending flowers on Mars']
type PageStatus = 'idle' | 'submitting' | 'polling' | 'cancelled' | 'timeout' | 'error'

export default function ImagePage() {
  const [models, setModels] = useState<ModelSummary[]>([])
  const [model, setModel] = useState<ImageModelAlias>('wanxiang')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState(IMAGE_SIZE_OPTIONS.wanxiang[0]!.value)
  const [count, setCount] = useState(1)
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelError, setModelError] = useState('')
  const [task, setTask] = useState<ImageTask | null>(null)
  const [pageStatus, setPageStatus] = useState<PageStatus>('idle')
  const [taskError, setTaskError] = useState('')
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [history, setHistory] = useState<ImageHistoryEntry[]>([])
  const activeRequest = useRef<AbortController | null>(null)

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

  useEffect(() => {
    setHistory(readImageHistory(localStorage.getItem(IMAGE_HISTORY_KEY)))
  }, [])

  useEffect(() => {
    if (!task || !submittedPrompt) return
    setHistory((current) => {
      const next = upsertImageHistory(current, {
        prompt: submittedPrompt,
        savedAt: new Date().toISOString(),
        task,
      })
      try {
        localStorage.setItem(IMAGE_HISTORY_KEY, JSON.stringify(next))
      } catch {
        // Storage can be unavailable or full; the active task remains usable in memory.
      }
      return next
    })
  }, [submittedPrompt, task])

  function changeModel(next: ImageModelAlias) {
    setModel(next)
    setSize(IMAGE_SIZE_OPTIONS[next][0]!.value)
    setCount((current) => Math.min(current, maxImageCount(next)))
  }

  const available = models.length > 0
  const active = pageStatus === 'submitting' || pageStatus === 'polling'
  const results = task ? imageResultItems(task, client.images.downloadUrl) : []

  async function submit() {
    if (active || !available) return
    const request = createImageRequest({ model, prompt, size, count })
    const controller = new AbortController()
    activeRequest.current = controller
    setTask(null)
    setSubmittedPrompt(request.prompt)
    setTaskError('')
    setPageStatus('submitting')
    try {
      const created = await client.images.create(request, { signal: controller.signal })
      setTask(created)
      if (created.status === 'succeeded' || created.status === 'failed') {
        setPageStatus('idle')
        return
      }
      setPageStatus('polling')
      const completed = await client.images.wait(created.taskId, {
        signal: controller.signal,
        timeoutMs: 120_000,
        onUpdate: setTask,
      })
      setTask(completed)
      setPageStatus('idle')
    } catch (error) {
      if (controller.signal.aborted) {
        setPageStatus('cancelled')
      } else if (error instanceof AIGatewayTimeoutError) {
        setPageStatus('timeout')
      } else {
        setPageStatus('error')
        setTaskError(error instanceof Error ? error.message : '图片任务处理失败')
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  function cancelPolling() {
    activeRequest.current?.abort()
  }

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
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-xl shadow-slate-900/5 sm:p-7 dark:border-white/10 dark:bg-white/5"
          >
            <label className="block text-sm font-semibold" htmlFor="image-prompt">
              Prompt
            </label>
            <textarea
              id="image-prompt"
              value={prompt}
              disabled={active}
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
                  disabled={active}
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

            {active ? (
              <button
                type="button"
                onClick={cancelPolling}
                className="mt-6 min-h-11 w-full rounded-xl border border-rose-300 px-5 font-semibold text-rose-600"
              >
                停止等待
              </button>
            ) : (
              <button
                type="submit"
                disabled={!prompt.trim() || !available}
                className="mt-6 min-h-11 w-full rounded-xl bg-slate-950 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950"
              >
                {loadingModels ? '加载模型中…' : '生成图片'}
              </button>
            )}

            <TaskStatus task={task} pageStatus={pageStatus} error={taskError} />
          </form>

          <aside className="h-fit rounded-3xl border border-slate-200/80 bg-white/70 p-5 sm:p-6 dark:border-white/10 dark:bg-white/5">
            <h2 className="font-semibold">生成设置</h2>
            <div className="mt-5 space-y-5">
              <Field label="模型">
                <select
                  value={model}
                  disabled={!available || active}
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
                  disabled={!available || active}
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
                  disabled={!available || active}
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

        {results.length > 0 && (
          <section className="mt-7" aria-labelledby="image-results-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-violet-700 dark:text-violet-300">
                  RESULTS
                </p>
                <h2 id="image-results-title" className="mt-2 text-2xl font-semibold">
                  生成结果
                </h2>
              </div>
              <p className="text-sm text-slate-500">{results.length} 张</p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {results.map((result) => (
                <article
                  key={result.index}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/5"
                >
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-slate-100 dark:bg-slate-900"
                    aria-label={`预览第 ${result.index + 1} 张图片`}
                  >
                    <img
                      src={result.url}
                      alt={`生成结果 ${result.index + 1}`}
                      className="aspect-square w-full object-contain"
                    />
                  </a>
                  <footer className="flex items-center justify-between gap-3 p-4 text-sm">
                    <span className="text-slate-500">
                      {result.width && result.height
                        ? `${result.width} × ${result.height}`
                        : `图片 ${result.index + 1}`}
                    </span>
                    <a
                      href={result.url}
                      download
                      className="rounded-lg border border-slate-200 px-3 py-2 font-semibold dark:border-white/10"
                    >
                      下载
                    </a>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="mt-10" aria-labelledby="image-history-title">
            <h2 id="image-history-title" className="text-2xl font-semibold">
              最近生成
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {history.map((entry) => {
                const thumbnail = imageResultItems(entry.task, client.images.downloadUrl)[0]
                return (
                  <article
                    key={entry.task.taskId}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white/75 dark:border-white/10 dark:bg-white/5"
                  >
                    {thumbnail ? (
                      <img
                        src={thumbnail.url}
                        alt="历史生成缩略图"
                        className="aspect-square w-full bg-slate-100 object-cover dark:bg-slate-900"
                      />
                    ) : (
                      <div className="grid aspect-square place-items-center bg-slate-100 text-xs text-slate-500 dark:bg-slate-900">
                        {entry.task.status}
                      </div>
                    )}
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs leading-5">{entry.prompt}</p>
                      <p className="mt-2 text-[0.68rem] text-slate-400">{entry.task.model}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function TaskStatus({
  task,
  pageStatus,
  error,
}: {
  task: ImageTask | null
  pageStatus: PageStatus
  error: string
}) {
  if (!task && pageStatus === 'idle') return null
  const status =
    pageStatus === 'submitting'
      ? '正在提交任务…'
      : pageStatus === 'cancelled'
        ? '已停止本页轮询，服务端任务可能仍在运行。'
        : pageStatus === 'timeout'
          ? '等待超时，服务端任务状态未被修改，可稍后继续查询。'
          : pageStatus === 'error'
            ? error
            : task?.status === 'pending'
              ? '任务已提交，等待模型处理…'
              : task?.status === 'running'
                ? '模型正在生成图片…'
                : task?.status === 'succeeded'
                  ? '图片生成完成。'
                  : task?.error?.message || '图片生成失败。'
  return (
    <section aria-live="polite" className="mt-5 rounded-2xl bg-slate-100 p-4 dark:bg-white/5">
      <p className="text-sm font-semibold">{status}</p>
      {task && <p className="mt-2 break-all text-xs text-slate-500">Task ID：{task.taskId}</p>}
    </section>
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
