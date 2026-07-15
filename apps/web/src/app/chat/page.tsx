'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type { FormEvent, KeyboardEvent } from 'react'
import { useReducer, useState } from 'react'

import { chatViewReducer, initialChatViewState, readableChatError } from './chat-view-state'

const client = createAIGatewayClient()

const examples = ['解释什么是 API 网关', '为周末杭州之旅列一个计划', '用简单比喻介绍大语言模型']

export default function ChatPage() {
  const [input, setInput] = useState('')
  const [state, dispatch] = useReducer(chatViewReducer, initialChatViewState)
  const isGenerating = state.status === 'loading' || state.status === 'streaming'

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const prompt = input.trim()
    if (!prompt || isGenerating) return

    dispatch({ type: 'submit', prompt })

    try {
      for await (const chatEvent of client.chat.stream({
        model: 'qwen',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      })) {
        if (chatEvent.type === 'delta') {
          dispatch({ type: 'delta', content: chatEvent.content })
          continue
        }
        if (chatEvent.type === 'error') {
          dispatch({ type: 'fail', message: chatEvent.error.message })
          return
        }
        if (chatEvent.type === 'done') dispatch({ type: 'complete' })
      }
    } catch (error) {
      dispatch({ type: 'fail', message: readableChatError(error) })
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <main className="px-5 py-8 sm:px-8 sm:py-12 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
              SINGLE MODEL
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              Chat
            </h1>
            <p className="mt-3 max-w-xl leading-7 text-slate-600 dark:text-slate-400">
              发出一条消息，实时查看统一网关返回的增量内容。
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            qwen · Mock 通道
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/65">
          <div
            className="min-h-[25rem] space-y-7 p-5 sm:min-h-[30rem] sm:p-8"
            aria-live="polite"
            aria-busy={isGenerating}
          >
            {state.status === 'idle' ? (
              <div className="grid min-h-[21rem] place-items-center text-center sm:min-h-[26rem]">
                <div className="max-w-xl">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-lg font-semibold text-white shadow-lg shadow-cyan-500/20">
                    ✦
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">
                    从一个问题开始
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    当前使用确定性 Mock Adapter，完整走通 SDK、SSE 与数据库记录链路。
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {examples.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setInput(example)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="ml-auto max-w-[88%] sm:max-w-[75%]">
                  <p className="mb-2 text-right text-xs font-medium text-slate-400">你</p>
                  <div className="rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-sm leading-7 text-white dark:bg-white dark:text-slate-950">
                    {state.prompt}
                  </div>
                </div>

                <div className="max-w-[92%] sm:max-w-[80%]">
                  <p className="mb-2 text-xs font-medium text-slate-400">AI Gateway</p>
                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                    {state.status === 'loading' ? (
                      <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
                        正在连接模型…
                      </span>
                    ) : (
                      <span className="whitespace-pre-wrap">
                        {state.response}
                        {state.status === 'streaming' && (
                          <span
                            className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-cyan-500 align-middle"
                            aria-label="正在生成"
                          />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {state.status === 'error' && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
                  >
                    <span className="font-semibold">请求失败：</span>
                    {state.error}
                  </div>
                )}
              </>
            )}
          </div>

          <form
            onSubmit={submit}
            className="border-t border-slate-200/80 bg-slate-50/80 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.025]"
          >
            <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-500/10 dark:border-white/10 dark:bg-white/5">
              <label htmlFor="chat-input" className="sr-only">
                输入消息
              </label>
              <textarea
                id="chat-input"
                rows={1}
                maxLength={4000}
                value={input}
                disabled={isGenerating}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="输入消息，Enter 发送，Shift + Enter 换行"
                className="max-h-40 min-h-11 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-white dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                {isGenerating ? '生成中' : '发送'}
              </button>
            </div>
            <p className="mt-2 px-1 text-xs text-slate-400">请勿提交密码、API Key 等敏感信息。</p>
          </form>
        </section>
      </div>
    </main>
  )
}
