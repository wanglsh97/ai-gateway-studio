'use client'

import type { PromptOptimizationMode } from '@aigateway/sdk'
import { useState } from 'react'

const modes: Array<{ value: PromptOptimizationMode; title: string; description: string }> = [
  { value: 'expand', title: '扩写', description: '补充背景、细节与表达要求' },
  { value: 'simplify', title: '精简', description: '删除冗余，保留核心意图' },
  { value: 'structure', title: '结构化', description: '整理为角色、任务与约束' },
]

const examples = [
  '帮我写一封项目延期说明邮件',
  'Summarize this product proposal for executives',
  '设计一个适合初学者的 TypeScript 学习计划',
]

export default function PromptPage() {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<PromptOptimizationMode>('expand')

  return (
    <main className="px-5 py-8 sm:px-8 sm:py-12 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
            PROMPT OPTIMIZER
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Prompt 优化</h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
            选择固定优化模式，把草稿转换为更清晰、可执行的 Prompt。
          </p>
        </header>

        <form
          onSubmit={(event) => event.preventDefault()}
          className="mt-7 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-xl shadow-slate-900/5 sm:p-7 dark:border-white/10 dark:bg-white/5"
        >
          <label htmlFor="original-prompt" className="text-sm font-semibold">
            原始 Prompt
          </label>
          <textarea
            id="original-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={4000}
            rows={9}
            placeholder="输入需要优化的 Prompt…"
            className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-transparent p-4 text-sm leading-7 outline-none focus:border-emerald-400 dark:border-white/10"
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

          <fieldset className="mt-7">
            <legend className="text-sm font-semibold">优化模式</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {modes.map((item) => (
                <label
                  key={item.value}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${mode === item.value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/25' : 'border-slate-200 dark:border-white/10'}`}
                >
                  <input
                    type="radio"
                    name="prompt-mode"
                    value={item.value}
                    checked={mode === item.value}
                    onChange={() => setMode(item.value)}
                    className="sr-only"
                  />
                  <span className="font-semibold">{item.title}</span>
                  <span className="mt-2 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {item.description}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={!prompt.trim()}
            className="mt-7 min-h-11 w-full rounded-xl bg-slate-950 px-5 font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-950"
          >
            优化 Prompt
          </button>
          <p className="mt-3 text-xs text-slate-400">优化接口调用将在下一功能点接入。</p>
        </form>
      </div>
    </main>
  )
}
