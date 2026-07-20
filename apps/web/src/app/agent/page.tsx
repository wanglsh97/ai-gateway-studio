'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type { TextModelAlias, TextModelId } from '@aigateway/sdk'
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  makeAssistantToolUI,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useLocalRuntime,
} from '@assistant-ui/react'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import {
  useAgentActiveThreadId,
  useAgentWorkspace,
} from '../../components/agent-workspace-provider'
import { ProtectedUserPage } from '../../components/protected-user-page'
import { useAuthenticationFailure } from '../../components/use-authentication-failure'
import { CHAT_PROVIDER_BRANDING } from '../../config/chat-provider-branding'
import { AssistantMarkdown } from '../chat/assistant-markdown'
import {
  agentMessagesToThreadMessages,
  createAgentRunAdapter,
  type AgentRunMetadata,
} from './agent-run-adapter'
import { shouldStartNewThreadOnModelChange } from './agent-model-policy'
import {
  foldEventsFromCursor,
  isResumableActiveRun,
  mergeThreadMessagesWithRunView,
} from './agent-run-resume'
import { initialAgentRunViewState } from './agent-run-reducer'

const client = createAIGatewayClient()

interface ModelOption {
  value: TextModelId
  label: string
  provider: TextModelAlias
}

export default function AgentPage() {
  return (
    <ProtectedUserPage>
      <Suspense fallback={<main className="agent-page" aria-busy="true" />}>
        <AgentConsole />
      </Suspense>
    </ProtectedUserPage>
  )
}

function AgentConsole() {
  const handleAuthenticationFailure = useAuthenticationFailure()
  const {
    models,
    selectedModel,
    setSelectedModel,
    openThread,
    prependThread,
    startNewThread,
    refreshThreads,
    userActiveRun,
    setUserActiveRun,
  } = useAgentWorkspace()
  const activeThreadId = useAgentActiveThreadId()

  const skipHydrationRef = useRef(false)
  const contextRef = useRef({
    threadId: activeThreadId as string | null,
    model: selectedModel,
    onThreadCreated: (() => undefined) as (thread: Parameters<typeof prependThread>[0]) => void,
    onRunCreated: (() => undefined) as (run: { id: string; threadId: string }) => void,
    onRunFinished: () => undefined,
  })

  contextRef.current.threadId = activeThreadId
  contextRef.current.model = selectedModel
  contextRef.current.onThreadCreated = (thread) => {
    skipHydrationRef.current = true
    prependThread(thread)
    openThread(thread.id)
  }
  contextRef.current.onRunCreated = (run) => {
    setUserActiveRun({
      id: run.id,
      threadId: run.threadId,
      status: 'running',
      limitReason: null,
      usage: {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        usageUnknown: true,
        estimatedCostCny: null,
        modelCalls: 0,
        toolCalls: 0,
        webFetchCalls: 0,
      },
      lastSequence: -1,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    })
  }
  contextRef.current.onRunFinished = () => {
    setUserActiveRun(null)
    void refreshThreads().catch(() => undefined)
  }

  const modelOptions = useMemo<ModelOption[]>(
    () =>
      models.flatMap((model) =>
        isTextModelAlias(model.alias)
          ? [{ value: model.id as TextModelId, label: model.displayName, provider: model.alias }]
          : [],
      ),
    [models],
  )

  const handleModelChange = (nextModel: TextModelId) => {
    const current = (selectedModel as TextModelId) || modelOptions[0]?.value || 'qwen3.7-plus'
    const leaveThread = shouldStartNewThreadOnModelChange(activeThreadId, current, nextModel)
    setSelectedModel(nextModel)
    if (leaveThread) {
      skipHydrationRef.current = false
      startNewThread()
    }
  }

  const adapter = useMemo(
    () =>
      createAgentRunAdapter(
        client,
        () => contextRef.current,
        (error) => {
          handleAuthenticationFailure(error)
        },
      ),
    [handleAuthenticationFailure],
  )

  const runtime = useLocalRuntime(adapter)
  const modelDisabled = modelOptions.length === 0
  const submitBlocked = modelDisabled || userActiveRun !== null

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadHydrator skipHydrationRef={skipHydrationRef} />
      <WebFetchToolUI />
      <main className="agent-page">
        <section className="agent-console agent-chat-panel" aria-label="智能体">
          <AgentThread
            modelDisabled={modelDisabled}
            submitBlocked={submitBlocked}
            activeRunHint={
              userActiveRun && userActiveRun.threadId !== activeThreadId
                ? '另一会话正在运行，请等待结束后再提交'
                : null
            }
            modelBoundToThread={activeThreadId !== null}
            modelOptions={modelOptions}
            selectedModel={(selectedModel as TextModelId) || modelOptions[0]?.value || 'qwen3.7-plus'}
            onModelChange={handleModelChange}
            onNewThread={startNewThread}
          />
        </section>
      </main>
    </AssistantRuntimeProvider>
  )
}

function ThreadHydrator({
  skipHydrationRef,
}: {
  skipHydrationRef: { current: boolean }
}) {
  const api = useAui()
  const activeThreadId = useAgentActiveThreadId()
  const { setSelectedModel, setUserActiveRun, refreshThreads } = useAgentWorkspace()
  const handleAuthenticationFailure = useAuthenticationFailure()

  const [interruptedNotice, setInterruptedNotice] = useState<string | null>(null)
  const [resumeNotice, setResumeNotice] = useState<string | null>(null)

  useEffect(() => {
    if (skipHydrationRef.current) {
      skipHydrationRef.current = false
      return
    }

    let cancelled = false
    const resumeAbort = new AbortController()

    void (async () => {
      try {
        if (!activeThreadId) {
          api.thread().reset([])
          setInterruptedNotice(null)
          setResumeNotice(null)
          return
        }
        const thread = await client.agent.threads.get(activeThreadId)
        if (cancelled) return
        setSelectedModel(thread.model)

        if (isResumableActiveRun(thread.activeRun)) {
          setUserActiveRun(thread.activeRun)
          setInterruptedNotice(null)
          setResumeNotice('运行仍在进行，正在按事件游标恢复…')
          api.thread().reset(agentMessagesToThreadMessages(thread.messages))

          let view = initialAgentRunViewState()
          let afterSequence = -1
          for await (const event of client.agent.runs.subscribe(thread.activeRun.id, {
            after: -1,
            signal: resumeAbort.signal,
          })) {
            if (cancelled) return
            view = foldEventsFromCursor([event], afterSequence, view)
            afterSequence = event.sequence
            api.thread().reset(
              agentMessagesToThreadMessages(mergeThreadMessagesWithRunView(thread.messages, view)),
            )
            if (event.type === 'run-terminal') {
              setResumeNotice(null)
              setUserActiveRun(null)
              void refreshThreads().catch(() => undefined)
              return
            }
          }
          return
        }

        const interrupted = thread.lastRun?.status === 'interrupted'
        setResumeNotice(null)
        setInterruptedNotice(
          interrupted ? '上次运行因服务重启中断，未自动重放模型或工具。可继续发送新任务。' : null,
        )
        if (thread.activeRun) setUserActiveRun(thread.activeRun)
        else setUserActiveRun(null)
        api.thread().reset(
          agentMessagesToThreadMessages(thread.messages, {
            lastRunStatus: thread.lastRun?.status ?? null,
          }),
        )
      } catch (error) {
        if (!cancelled && !resumeAbort.signal.aborted) handleAuthenticationFailure(error)
      }
    })()

    return () => {
      cancelled = true
      // 仅断开补读 SSE；不得 cancel 服务端 run
      resumeAbort.abort()
    }
  }, [activeThreadId])

  if (interruptedNotice) {
    return (
      <p className="agent-interrupted-banner" role="status">
        {interruptedNotice}
      </p>
    )
  }
  if (resumeNotice) {
    return (
      <p className="agent-interrupted-banner" role="status">
        {resumeNotice}
      </p>
    )
  }
  return null
}

/** 显式停止：先调 cancel API，再断开本端读取。浏览器刷新/卸载不得走此路径。 */
function AgentStopButton() {
  const { userActiveRun, setUserActiveRun, refreshThreads } = useAgentWorkspace()
  const handleAuthenticationFailure = useAuthenticationFailure()
  const isRunning = useAuiState(({ thread }) => thread.isRunning)
  const [stopping, setStopping] = useState(false)

  const runId = userActiveRun?.id ?? null
  if (!isRunning && !runId) return null

  const requestCancel = () => {
    if (!runId || stopping) return
    setStopping(true)
    void client.agent.runs
      .cancel(runId)
      .then((run) => {
        // 保持全局锁直到终态；仅更新为 cancelling，避免提前解锁提交
        setUserActiveRun(run)
        void refreshThreads().catch(() => undefined)
      })
      .catch((error) => {
        handleAuthenticationFailure(error)
        setStopping(false)
      })
  }

  if (isRunning) {
    return (
      <ComposerPrimitive.Cancel
        className="agent-send-button is-cancel"
        disabled={stopping}
        onClick={requestCancel}
      >
        {stopping ? '停止中…' : '停止'}
      </ComposerPrimitive.Cancel>
    )
  }

  return (
    <button
      type="button"
      className="agent-send-button is-cancel"
      disabled={stopping}
      onClick={requestCancel}
    >
      {stopping ? '停止中…' : '停止'}
    </button>
  )
}

function AgentThread({
  modelDisabled,
  submitBlocked,
  activeRunHint,
  modelBoundToThread,
  modelOptions,
  selectedModel,
  onModelChange,
  onNewThread,
}: {
  modelDisabled: boolean
  submitBlocked: boolean
  activeRunHint: string | null
  modelBoundToThread: boolean
  modelOptions: ReadonlyArray<ModelOption>
  selectedModel: TextModelId
  onModelChange: (model: TextModelId) => void
  onNewThread: () => void
}) {
  return (
    <ThreadPrimitive.Root className="agent-thread">
      <ThreadPrimitive.Viewport className="agent-thread-viewport">
        <ThreadPrimitive.Empty>
          <AgentEmptyState />
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages>
          {({ message }) => (message.role === 'user' ? <UserMessage /> : <AssistantMessage />)}
        </ThreadPrimitive.Messages>
      </ThreadPrimitive.Viewport>
      <ThreadPrimitive.ScrollToBottom className="agent-scroll-button" aria-label="滚动到底部">
        ↓
      </ThreadPrimitive.ScrollToBottom>
      <div className="agent-composer-dock">
        {activeRunHint ? <p className="agent-active-run-hint">{activeRunHint}</p> : null}
        <ComposerPrimitive.Root className="agent-composer">
          <ComposerPrimitive.Input
            aria-label="描述 Agent 任务"
            rows={1}
            maxLength={8000}
            disabled={submitBlocked}
            placeholder={
              submitBlocked && !modelDisabled
                ? '已有进行中的 Agent 运行，请等待结束后再提交…'
                : '描述你想让 Agent 完成的任务…'
            }
          />
          <div className="agent-composer-footer">
            <div className="agent-composer-actions">
              <NewThreadButton onNewThread={onNewThread} />
            </div>
            <div className="agent-composer-submit-group">
              <ModelSelect
                value={selectedModel}
                options={modelOptions}
                disabled={modelDisabled}
                boundHint={modelBoundToThread}
                onChange={onModelChange}
              />
              <AgentStopButton />
              <AuiIf condition={({ thread }) => !thread.isRunning && !submitBlocked}>
                <ComposerPrimitive.Send className="agent-send-button" aria-label="发送任务">
                  <svg aria-hidden="true" viewBox="0 0 20 20">
                    <path d="M10 15V5m0 0L6 9m4-4 4 4" />
                  </svg>
                </ComposerPrimitive.Send>
              </AuiIf>
              <AuiIf condition={({ thread }) => !thread.isRunning && submitBlocked}>
                <button type="button" className="agent-send-button" disabled aria-label="发送任务">
                  <svg aria-hidden="true" viewBox="0 0 20 20">
                    <path d="M10 15V5m0 0L6 9m4-4 4 4" />
                  </svg>
                </button>
              </AuiIf>
            </div>
          </div>
        </ComposerPrimitive.Root>
        <p className="agent-privacy-note">内容由 AI 生成，请仔细甄别</p>
      </div>
    </ThreadPrimitive.Root>
  )
}

const WebFetchToolUI = makeAssistantToolUI<
  { url?: string },
  { summary?: string; status?: string; audit?: Record<string, unknown> }
>({
  toolName: 'web_fetch',
  render: ({ args, result, status, isError }) => {
    const url = typeof args.url === 'string' ? args.url : ''
    const finalUrl =
      typeof result?.audit?.finalUrl === 'string' ? result.audit.finalUrl : undefined
    const httpStatus = typeof result?.audit?.status === 'number' ? result.audit.status : undefined
    const running = status.type === 'running'

    if (running) {
      return (
        <div className="agent-tool-call">
          <span className="agent-tool-name">web_fetch</span>
          {url ? <span className="agent-tool-target">{url}</span> : null}
          <span className="agent-tool-status is-running">调用中…</span>
        </div>
      )
    }

    return (
      <div className={`agent-tool-result${isError ? ' is-error' : ''}`}>
        <div className="agent-tool-result-head">
          <span className="agent-tool-name">web_fetch</span>
          <span className={`agent-tool-status is-${result?.status ?? 'succeeded'}`}>
            {result?.status ?? (isError ? 'failed' : 'succeeded')}
          </span>
          {httpStatus ? <span className="agent-tool-http">HTTP {httpStatus}</span> : null}
        </div>
        {result?.summary ? <p className="agent-tool-summary">{result.summary}</p> : null}
        {finalUrl ? (
          <a className="agent-tool-link" href={finalUrl} target="_blank" rel="noreferrer noopener">
            {finalUrl}
          </a>
        ) : null}
      </div>
    )
  },
})

function ModelSelect({
  value,
  options,
  disabled,
  boundHint,
  onChange,
}: {
  value: TextModelId
  options: ReadonlyArray<ModelOption>
  disabled: boolean
  boundHint: boolean
  onChange: (value: TextModelId) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value
  const selectedProvider = options.find((option) => option.value === value)?.provider ?? 'qwen'

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  return (
    <div
      className="agent-model-picker"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        className="agent-model-trigger"
        disabled={disabled}
        aria-label={
          boundHint
            ? `当前会话模型：${selectedLabel}（切换将新建会话）`
            : `运行模型：${selectedLabel}`
        }
        title={boundHint ? '切换模型将新建会话，当前会话保持不变' : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ModelLogo alias={selectedProvider} />
        <span className="agent-model-trigger-label">{selectedLabel}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="m5 6 3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="agent-model-menu" role="listbox" aria-label="选择运行模型">
          <p>{boundHint ? '切换模型将新建会话' : '运行模型'}</p>
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={selected ? 'is-selected' : undefined}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className="agent-model-option-main">
                  <ModelLogo alias={option.provider} />
                  <span>{option.label}</span>
                </span>
                {selected && <span aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModelLogo({ alias }: { alias: TextModelAlias }) {
  const branding = CHAT_PROVIDER_BRANDING[alias]
  return (
    <span
      className={`agent-model-logo is-${alias}${branding.logoUrl ? ' has-logo' : ''}`}
      style={branding.logoUrl ? { backgroundImage: `url("${branding.logoUrl}")` } : undefined}
      aria-hidden="true"
    >
      {!branding.logoUrl && <span>{branding.fallbackText}</span>}
    </span>
  )
}

function AgentEmptyState() {
  const api = useAui()
  const examples = [
    '总结 https://example.com/ 页面要点',
    '抓取指定 URL 并对比两处说法是否一致',
    '根据网页内容整理一份简短行动清单',
  ]
  return (
    <div className="agent-empty-state">
      <div className="agent-orbit" aria-hidden="true">
        <span>AI</span>
      </div>
      <p className="agent-empty-kicker">AGENT THREAD · EMPTY</p>
      <h2>交给 Agent 一个可执行的任务</h2>
      <p>它可以自主调用工具（如 web_fetch），并在同一会话里跨多轮完成。</p>
      <div className="agent-suggestions">
        {examples.map((example) => (
          <button key={example} type="button" onClick={() => api.composer().setText(example)}>
            {example}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="agent-message is-user">
      <div className="agent-message-label">YOU</div>
      <div className="agent-user-bubble">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="agent-message is-assistant">
      <div className="agent-assistant-rail" aria-hidden="true">
        <span>AI</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="agent-message-label">AI GATEWAY · AGENT</div>
        <div className="agent-assistant-content">
          <MessagePrimitive.Parts>
            {({ part }) => {
              if (part.type === 'tool-call') return part.toolUI ?? null
              if (part.type === 'text') {
                return <AssistantMarkdown>{part.text}</AssistantMarkdown>
              }
              if (part.type === 'reasoning') {
                return (
                  <details className="agent-reasoning">
                    <summary>推理过程（可能不完整或不准确）</summary>
                    <div>{part.text}</div>
                  </details>
                )
              }
              return null
            }}
          </MessagePrimitive.Parts>
          <AuiIf condition={({ message }) => message.status?.type === 'running'}>
            <span className="agent-stream-caret" aria-label="正在生成" />
          </AuiIf>
        </div>
        <MessagePrimitive.Error>
          <ErrorPrimitive.Root className="agent-message-error" role="alert">
            请求失败：
            <ErrorPrimitive.Message />
          </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
        <div className="agent-message-foot">
          <MessageMetadata />
          <ActionBarPrimitive.Root className="agent-message-actions">
            <ActionBarPrimitive.Copy className="agent-copy-button">复制</ActionBarPrimitive.Copy>
          </ActionBarPrimitive.Root>
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

function MessageMetadata() {
  const custom = useAuiState(({ message }) => message.metadata.custom) as AgentRunMetadata
  const status = useAuiState(({ message }) => message.status)
  const interrupted = custom.runStatus === 'interrupted' || status?.type === 'incomplete'
  return (
    <p>
      {custom.model ?? '模型'}
      {status?.type === 'running'
        ? ' · 生成中'
        : custom.runStatus === 'interrupted'
          ? ' · 已中断'
          : custom.totalTokens != null
            ? ` · ${custom.totalTokens} tokens`
            : ''}
      {custom.modelCalls != null ? ` · 模型 ${custom.modelCalls}` : ''}
      {custom.toolCalls != null ? ` · 工具 ${custom.toolCalls}` : ''}
      {interrupted && custom.runStatus === 'interrupted' ? ' · 未自动重放' : ''}
    </p>
  )
}

function NewThreadButton({ onNewThread }: { onNewThread: () => void }) {
  const hasMessages = useAuiState(({ thread }) => thread.messages.length > 0)
  if (!hasMessages) return null
  return (
    <button type="button" className="agent-composer-action" onClick={onNewThread}>
      新会话
    </button>
  )
}

function isTextModelAlias(value: string): value is TextModelAlias {
  return ['qwen', 'glm', 'deepseek', 'kimi'].includes(value)
}
