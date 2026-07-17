'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type { ChatMessage, TextModelAlias } from '@aigateway/sdk'
import type { FormEvent, KeyboardEvent } from 'react'
import { useEffect, useReducer, useRef, useState } from 'react'

import type { ChatViewMessage } from './chat-view-state'
import { chatViewReducer, initialChatViewState, readableChatError } from './chat-view-state'

const client = createAIGatewayClient()
const examples = ['解释什么是 API 网关', '为周末杭州之旅列一个计划', '用简单比喻介绍大语言模型']
const fallbackModelOptions: ReadonlyArray<{ value: TextModelAlias; label: string }> = [
  { value: 'kimi', label: 'Kimi' },
  { value: 'qwen', label: '通义千问 Qwen' },
  { value: 'glm', label: '智谱 GLM' },
  { value: 'deepseek', label: 'DeepSeek' },
]

export default function ChatPage() {
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState<TextModelAlias>('kimi')
  const [modelOptions, setModelOptions] = useState(fallbackModelOptions)
  const [modelError, setModelError] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(0.9)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [state, dispatch] = useReducer(chatViewReducer, initialChatViewState)
  const activeRequest = useRef<AbortController | null>(null)
  const isGenerating = state.status === 'loading' || state.status === 'streaming'

  useEffect(() => {
    let active = true
    void client.models
      .list()
      .then((models) => {
        if (!active) return
        const enabled = models.flatMap((model) =>
          model.enabled && model.capabilities.includes('chat') && isTextModelAlias(model.alias)
            ? [{ value: model.alias, label: model.displayName }]
            : [],
        )
        setModelOptions(enabled)
        if (enabled[0]) {
          setSelectedModel((current) =>
            enabled.some(({ value }) => value === current) ? current : enabled[0]!.value,
          )
        }
      })
      .catch(() => {
        if (active) setModelError('模型列表加载失败，请稍后刷新')
      })
    return () => {
      active = false
    }
  }, [])

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const prompt = input.trim()
    if (!prompt || isGenerating || modelOptions.length === 0) return
    const messages: ChatMessage[] = [
      ...state.messages
        .filter(({ content }) => content.trim())
        .map(({ role, content }) => ({ role, content })),
      { role: 'user', content: prompt },
    ]
    const controller = new AbortController()
    activeRequest.current = controller
    setInput('')
    dispatch({ type: 'submit', prompt })

    try {
      for await (const event of client.chat.stream(
        {
          model: selectedModel,
          messages,
          stream: true,
          temperature,
          topP,
          maxTokens,
        },
        { signal: controller.signal },
      )) {
        if (event.type === 'start') {
          dispatch({ type: 'started', requestId: event.requestId, model: event.model })
        } else if (event.type === 'delta') {
          dispatch({ type: 'delta', content: event.content })
        } else if (event.type === 'usage') {
          dispatch({ type: 'usage', usage: event.usage })
        } else if (event.type === 'error') {
          dispatch({ type: 'fail', message: event.error.message })
          return
        } else if (event.type === 'done') {
          dispatch({ type: 'complete' })
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: 'fail', message: readableChatError(error) })
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  function stopGeneration() {
    activeRequest.current?.abort()
    dispatch({ type: 'cancel' })
  }

  function newConversation() {
    activeRequest.current?.abort()
    activeRequest.current = null
    setInput('')
    dispatch({ type: 'clear' })
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
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
              SINGLE MODEL
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Chat</h1>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              保留上下文进行多轮对话，并实时查看流式结果。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state.messages.length > 0 && (
              <ToolbarButton onClick={newConversation}>新会话</ToolbarButton>
            )}
            <ToolbarButton onClick={() => setSettingsOpen((open) => !open)}>参数</ToolbarButton>
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 py-1 pl-3 pr-1.5 text-xs dark:border-white/10 dark:bg-white/5">
              模型
              <select
                value={selectedModel}
                disabled={isGenerating || modelOptions.length === 0}
                onChange={(event) => setSelectedModel(event.target.value as TextModelAlias)}
                className="min-h-8 rounded-full border border-slate-200 bg-white px-2.5 font-semibold dark:border-white/10 dark:bg-slate-900"
              >
                {modelOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {modelError && (
          <p role="alert" className="mt-4 text-sm text-rose-600">
            {modelError}
          </p>
        )}

        {settingsOpen && (
          <section
            aria-label="生成参数"
            className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white/75 p-4 sm:grid-cols-3 dark:border-white/10 dark:bg-white/5"
          >
            <Parameter
              label="Temperature"
              value={temperature}
              min={0}
              max={2}
              step={0.1}
              onChange={setTemperature}
            />
            <Parameter label="Top P" value={topP} min={0} max={1} step={0.05} onChange={setTopP} />
            <Parameter
              label="Max tokens"
              value={maxTokens}
              min={1}
              max={4096}
              step={1}
              onChange={setMaxTokens}
            />
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/75 shadow-xl dark:border-white/10 dark:bg-slate-950/65">
          <div
            className="min-h-[28rem] space-y-7 p-5 sm:p-8"
            aria-live="polite"
            aria-busy={isGenerating}
          >
            {state.messages.length === 0 ? (
              <EmptyState onSelect={setInput} />
            ) : (
              state.messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
          </div>

          <form
            onSubmit={submit}
            className="border-t border-slate-200/80 bg-slate-50/80 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.025]"
          >
            <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-cyan-400 dark:border-white/10 dark:bg-white/5">
              <textarea
                aria-label="输入消息"
                rows={1}
                maxLength={4000}
                value={input}
                disabled={isGenerating}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="输入消息，Enter 发送，Shift + Enter 换行"
                className="max-h-40 min-h-11 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm outline-none disabled:opacity-60"
              />
              {isGenerating ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-white/15"
                >
                  停止
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || modelOptions.length === 0}
                  className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-950"
                >
                  发送
                </button>
              )}
            </div>
            <p className="mt-2 px-1 text-xs text-slate-400">
              当前上下文 {state.messages.length} 条消息 · 请勿提交密码或 API Key。
            </p>
          </form>
        </section>
      </div>
    </main>
  )
}

function isTextModelAlias(value: string): value is TextModelAlias {
  return ['qwen', 'glm', 'deepseek', 'kimi'].includes(value)
}

function MessageBubble({ message }: { message: ChatViewMessage }) {
  const assistant = message.role === 'assistant'
  return (
    <div
      className={assistant ? 'max-w-[92%] sm:max-w-[80%]' : 'ml-auto max-w-[88%] sm:max-w-[75%]'}
    >
      <p className={`mb-2 text-xs font-medium text-slate-400 ${assistant ? '' : 'text-right'}`}>
        {assistant ? 'AI Gateway' : '你'}
      </p>
      <div
        className={
          assistant
            ? 'rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 dark:border-white/10 dark:bg-white/5'
            : 'rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-sm leading-7 text-white dark:bg-white dark:text-slate-950'
        }
      >
        {assistant && message.status === 'loading' ? (
          '正在连接模型…'
        ) : (
          <span className="whitespace-pre-wrap">
            {message.content || '尚未返回内容'}
            {message.status === 'streaming' && (
              <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-cyan-500" />
            )}
          </span>
        )}
      </div>
      {assistant && message.status === 'cancelled' && (
        <p className="mt-2 text-xs text-amber-600">已停止生成</p>
      )}
      {assistant && message.error && (
        <p role="alert" className="mt-2 text-xs text-rose-600">
          请求失败：{message.error}
        </p>
      )}
      {assistant && message.status === 'success' && (
        <p className="mt-2 break-all text-xs text-slate-400">
          {message.model} ·{' '}
          {message.usage?.usageUnknown
            ? 'Token 未知'
            : `${message.usage?.totalTokens ?? '—'} tokens`}
          {message.usage?.estimatedCostCny ? ` · ¥${message.usage.estimatedCostCny}` : ''}
          {message.requestId ? ` · ${message.requestId}` : ''}
        </p>
      )}
    </div>
  )
}

function EmptyState({ onSelect }: { onSelect: (value: string) => void }) {
  return (
    <div className="grid min-h-[24rem] place-items-center text-center">
      <div>
        <h2 className="text-xl font-semibold">从一个问题开始</h2>
        <p className="mt-2 text-sm text-slate-500">后续问题会自动携带当前会话历史。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onSelect(example)}
              className="rounded-full border border-slate-200 px-3 py-2 text-xs dark:border-white/10"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 rounded-full border border-slate-200 bg-white/75 px-3 text-xs font-medium dark:border-white/10 dark:bg-white/5"
    >
      {children}
    </button>
  )
}

function Parameter({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
      <span className="flex justify-between">
        <span>{label}</span>
        <output>{value}</output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={false}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-cyan-600"
      />
    </label>
  )
}
