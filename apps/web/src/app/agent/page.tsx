'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type {
  AgentMessage,
  AgentMessagePart,
  AgentThread,
  AgentThreadSummary,
  ModelSummary,
} from '@aigateway/sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ProtectedUserPage } from '../../components/protected-user-page'
import { useAuthenticationFailure } from '../../components/use-authentication-failure'
import { AssistantMarkdown } from '../chat/assistant-markdown'
import {
  initialAgentRunViewState,
  isActiveStatus,
  reduceAgentEvent,
  type AgentRunViewState,
} from './agent-run-reducer'

const client = createAIGatewayClient()

export default function AgentPage() {
  return (
    <ProtectedUserPage>
      <AgentConsole />
    </ProtectedUserPage>
  )
}

function AgentConsole() {
  const handleAuthenticationFailure = useAuthenticationFailure()
  const [threads, setThreads] = useState<AgentThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [models, setModels] = useState<ModelSummary[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [persistedMessages, setPersistedMessages] = useState<AgentMessage[]>([])
  const [runState, setRunState] = useState<AgentRunViewState>(initialAgentRunViewState())
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const subscriptionRef = useRef<AbortController | null>(null)

  const reportError = useCallback(
    (unknownError: unknown, fallback: string) => {
      if (handleAuthenticationFailure(unknownError)) return
      setError(unknownError instanceof Error ? unknownError.message : fallback)
    },
    [handleAuthenticationFailure],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [threadList, modelList] = await Promise.all([
          client.agent.threads.list(),
          client.models.list(),
        ])
        if (cancelled) return
        setThreads(threadList)
        const usable = modelList.filter((model) => model.enabled && model.capabilities.includes('chat'))
        setModels(usable)
        setSelectedModel((current) => current || usable[0]?.id || '')
      } catch (unknownError) {
        if (!cancelled) reportError(unknownError, '加载 Agent 会话失败')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reportError])

  useEffect(() => {
    return () => subscriptionRef.current?.abort()
  }, [])

  const subscribeToRun = useCallback(
    (threadId: string, runId: string, after: number) => {
      subscriptionRef.current?.abort()
      const controller = new AbortController()
      subscriptionRef.current = controller
      void (async () => {
        try {
          for await (const event of client.agent.runs.subscribe(runId, {
            after,
            signal: controller.signal,
          })) {
            setRunState((state) => reduceAgentEvent(state, event))
            if (event.type === 'run-terminal') {
              await refreshThread(threadId)
            }
          }
        } catch (unknownError) {
          if (controller.signal.aborted) return
          reportError(unknownError, 'Agent 事件流中断')
        } finally {
          if (subscriptionRef.current === controller) {
            subscriptionRef.current = null
            setActiveRunId(null)
          }
        }
      })()
    },
    [reportError],
  )

  const refreshThread = useCallback(
    async (threadId: string): Promise<AgentThread | null> => {
      try {
        const thread = await client.agent.threads.get(threadId)
        setPersistedMessages(thread.messages)
        setRunState(initialAgentRunViewState())
        return thread
      } catch (unknownError) {
        reportError(unknownError, '加载会话详情失败')
        return null
      }
    },
    [reportError],
  )

  const openThread = useCallback(
    async (threadId: string) => {
      setActiveThreadId(threadId)
      setError(null)
      const thread = await refreshThread(threadId)
      if (thread?.activeRun && isActiveStatus(thread.activeRun.status)) {
        setActiveRunId(thread.activeRun.id)
        subscribeToRun(threadId, thread.activeRun.id, -1)
      } else {
        setActiveRunId(null)
      }
    },
    [refreshThread, subscribeToRun],
  )

  const startNewThread = useCallback(() => {
    subscriptionRef.current?.abort()
    setActiveThreadId(null)
    setPersistedMessages([])
    setRunState(initialAgentRunViewState())
    setActiveRunId(null)
    setError(null)
  }, [])

  const submit = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || busy || activeRunId) return
    setBusy(true)
    setError(null)
    try {
      let threadId = activeThreadId
      if (!threadId) {
        if (!selectedModel) {
          setError('没有可用的 Agent 模型')
          return
        }
        const created = await client.agent.threads.create({ model: selectedModel })
        threadId = created.id
        setActiveThreadId(threadId)
        setThreads((current) => [created, ...current])
      }
      setPersistedMessages((current) => [
        ...current,
        { id: `local-${Date.now()}`, role: 'user', parts: [{ type: 'text', text: trimmed }], createdAt: '' },
      ])
      setRunState(initialAgentRunViewState())
      setInput('')
      const run = await client.agent.runs.create(threadId, { input: trimmed })
      setActiveRunId(run.id)
      subscribeToRun(threadId, run.id, -1)
    } catch (unknownError) {
      reportError(unknownError, '发起 Agent 运行失败')
    } finally {
      setBusy(false)
    }
  }, [activeRunId, activeThreadId, busy, input, reportError, selectedModel, subscribeToRun])

  const stop = useCallback(async () => {
    if (!activeRunId) return
    try {
      await client.agent.runs.cancel(activeRunId)
    } catch (unknownError) {
      reportError(unknownError, '取消运行失败')
    }
  }, [activeRunId, reportError])

  const messages = useMemo(
    () => [...persistedMessages, ...runState.messages],
    [persistedMessages, runState.messages],
  )
  const running = isActiveStatus(runState.status) || activeRunId !== null

  return (
    <main className="agent-page">
      <div className="agent-layout">
        <aside className="agent-sidebar">
          <button type="button" className="agent-new-thread" onClick={startNewThread}>
            + 新建会话
          </button>
          <label className="agent-model-picker">
            <span>模型</span>
            <select
              value={selectedModel}
              disabled={activeThreadId !== null || running}
              onChange={(event) => setSelectedModel(event.target.value)}
            >
              {models.length === 0 ? <option value="">无可用模型</option> : null}
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </label>
          <ul className="agent-thread-list">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  className={`agent-thread-item${thread.id === activeThreadId ? ' is-active' : ''}`}
                  onClick={() => void openThread(thread.id)}
                >
                  {thread.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="agent-console agent-chat-panel">
          {error ? (
            <div className="agent-message-error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="agent-thread">
            {messages.length === 0 ? (
              <p className="agent-empty">向 Agent 提出任务，它可以自主调用工具（如 web_fetch）并跨多轮完成。</p>
            ) : (
              messages.map((message) => <MessageView key={message.id} message={message} />)
            )}
            {running ? <StatusLine status={runState.status} /> : null}
            {runState.status === 'cancelled' ? <p className="agent-note">运行已取消。</p> : null}
            {runState.status === 'limit_reached' ? (
              <p className="agent-note">已达到运行上限（{runState.limitReason ?? '限制'}）。</p>
            ) : null}
            {runState.usage ? (
              <p className="agent-usage">
                模型调用 {runState.usage.modelCalls} · 工具调用 {runState.usage.toolCalls} · Token{' '}
                {runState.usage.totalTokens ?? '—'}
              </p>
            ) : null}
          </div>

          <form
            className="agent-composer"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="描述你想让 Agent 完成的任务…"
              rows={2}
              disabled={running}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void submit()
                }
              }}
            />
            {running ? (
              <button type="button" className="agent-stop" onClick={() => void stop()}>
                停止
              </button>
            ) : (
              <button type="submit" className="agent-send" disabled={busy || input.trim().length === 0}>
                发送
              </button>
            )}
          </form>
        </section>
      </div>
    </main>
  )
}

function StatusLine({ status }: { status: AgentRunViewState['status'] }) {
  const label = status === 'cancelling' ? '正在取消…' : 'Agent 正在工作…'
  return (
    <p className="agent-status-line">
      <span className="agent-stream-caret" aria-hidden />
      {label}
    </p>
  )
}

function MessageView({ message }: { message: AgentMessage }) {
  if (message.role === 'tool') {
    return (
      <>
        {message.parts.map((part, index) => (
          <PartView key={index} part={part} />
        ))}
      </>
    )
  }
  return (
    <div className={`agent-message is-${message.role}`}>
      {message.parts.map((part, index) => (
        <PartView key={index} part={part} role={message.role} />
      ))}
    </div>
  )
}

function PartView({ part, role }: { part: AgentMessagePart; role?: AgentMessage['role'] }) {
  if (part.type === 'text') {
    return role === 'assistant' ? (
      <AssistantMarkdown>{part.text}</AssistantMarkdown>
    ) : (
      <p className="agent-user-text">{part.text}</p>
    )
  }
  if (part.type === 'reasoning') {
    return (
      <details className="agent-reasoning">
        <summary>推理过程（可能不完整或不准确）</summary>
        <div>{part.text}</div>
      </details>
    )
  }
  if (part.type === 'tool-call') {
    const url = typeof part.args.url === 'string' ? part.args.url : ''
    return (
      <div className="agent-tool-call">
        <span className="agent-tool-name">{part.toolName}</span>
        {url ? <span className="agent-tool-target">{url}</span> : null}
        <span className="agent-tool-status is-running">调用中…</span>
      </div>
    )
  }
  // tool-result
  const finalUrl = typeof part.audit?.finalUrl === 'string' ? part.audit.finalUrl : undefined
  const httpStatus = typeof part.audit?.status === 'number' ? part.audit.status : undefined
  return (
    <div className={`agent-tool-result${part.isError ? ' is-error' : ''}`}>
      <div className="agent-tool-result-head">
        <span className="agent-tool-name">{part.toolName}</span>
        <span className={`agent-tool-status is-${part.status}`}>{part.status}</span>
        {httpStatus ? <span className="agent-tool-http">HTTP {httpStatus}</span> : null}
      </div>
      <p className="agent-tool-summary">{part.summary}</p>
      {finalUrl ? (
        <a className="agent-tool-link" href={finalUrl} target="_blank" rel="noreferrer noopener">
          {finalUrl}
        </a>
      ) : null}
    </div>
  )
}
