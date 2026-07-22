'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type {
  AgentContextBudgetState,
  AgentContextSummary,
  AgentStreamEvent,
  TextModelAlias,
  TextModelId,
} from '@aigateway/sdk'
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  makeAssistantToolUI,
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
import {
  AgentActiveRunHint,
  AgentComposerAction,
  AgentComposerActions,
  AgentComposerDock,
  AgentComposerFooter,
  AgentComposerInput,
  AgentComposerRoot,
  AgentComposerSubmitGroup,
  AgentConsolePanel,
  AgentEmptyState,
  AgentInterruptedBanner,
  AgentPageShell,
  AgentPrivacyNote,
  AgentReasoning,
  AgentRunMetadata,
  AgentScrollToBottom,
  AgentSendButton,
  AgentSendButtonDisabled,
  AgentThreadRoot,
  AgentThreadViewport,
  AgentToolCall,
  AgentToolResult,
  AssistantMessage,
  ModelSelect,
  NewThreadButton,
  UserMessage,
} from '../../components/chat-thread-ui'
import { ProtectedUserPage } from '../../components/protected-user-page'
import { useAuthenticationFailure } from '../../components/use-authentication-failure'
import { cn } from '../../lib/cn'
import { AssistantMarkdown } from '../chat/assistant-markdown'
import {
  agentMessagesToThreadMessages,
  createAgentRunAdapter,
  type AgentRunMetadata as AgentRunMetadataType,
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
      <Suspense fallback={<AgentPageShell aria-busy="true" />}>
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
  const [contextBudget, setContextBudget] = useState<AgentContextBudgetState | null>(null)
  const [contextSummary, setContextSummary] = useState<AgentContextSummary | null>(null)
  const [compressionEvents, setCompressionEvents] = useState<
    Extract<AgentStreamEvent, { type: 'context-compressed' }>[]
  >([])

  const skipHydrationRef = useRef(false)
  const contextRef = useRef({
    threadId: activeThreadId as string | null,
    model: selectedModel,
    onThreadCreated: (() => undefined) as (thread: Parameters<typeof prependThread>[0]) => void,
    onRunCreated: (() => undefined) as (run: { id: string; threadId: string }) => void,
    onRunFinished: () => undefined,
    onContextBudget: (_budget: AgentContextBudgetState) => undefined,
    onContextCompressed: (_event: Extract<AgentStreamEvent, { type: 'context-compressed' }>) => undefined,
  })

  contextRef.current.threadId = activeThreadId
  contextRef.current.model = selectedModel
  contextRef.current.onThreadCreated = (thread) => {
    skipHydrationRef.current = true
    setContextBudget(null)
    setContextSummary(null)
    setCompressionEvents([])
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
  contextRef.current.onContextBudget = setContextBudget
  contextRef.current.onContextCompressed = (event) => {
    setCompressionEvents((current) => [...current, event])
    if (event.summaryId && contextRef.current.threadId) {
      void client.agent.threads.get(contextRef.current.threadId).then((thread) => {
        setContextSummary(thread.contextSummary)
      }).catch(() => undefined)
    }
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
      <ThreadHydrator
        skipHydrationRef={skipHydrationRef}
        onContextBudget={setContextBudget}
        onContextSummary={setContextSummary}
        onCompressionEvent={(event) => setCompressionEvents((current) => [...current, event])}
        onResetCompressionEvents={() => setCompressionEvents([])}
      />
      <WebFetchToolUI />
      <AgentPageShell>
        <AgentConsolePanel label="智能体">
          <AgentThreadRoot>
            <AgentThreadViewport>
              <ThreadPrimitive.Empty>
                <AgentEmptyState
                  kicker="AGENT THREAD · EMPTY"
                  title="交给 Agent 一个可执行的任务"
                  description="它可以自主调用工具（如 web_fetch），并在同一会话里跨多轮完成。"
                  examples={[
                    '总结 https://example.com/ 页面要点',
                    '抓取指定 URL 并对比两处说法是否一致',
                    '根据网页内容整理一份简短行动清单',
                  ]}
                />
              </ThreadPrimitive.Empty>
              <ThreadPrimitive.Messages>
                {({ message }) =>
                  message.role === 'user' ? (
                    <UserMessage />
                  ) : (
                    <AssistantMessage
                      label="AI GATEWAY · AGENT"
                      metadata={<AgentMessageMetadata />}
                      renderPart={(part) => {
                        if (part.type === 'tool-call') return part.toolUI ?? null
                        if (part.type === 'text') return <AssistantMarkdown>{part.text ?? ''}</AssistantMarkdown>
                        if (part.type === 'reasoning') {
                          return <AgentReasoning text={part.text ?? ''} />
                        }
                        return null
                      }}
                    />
                  )
                }
              </ThreadPrimitive.Messages>
              <AgentContextTimeline events={compressionEvents} summary={contextSummary} />
            </AgentThreadViewport>
            <AgentScrollToBottom />
            <AgentComposerDock>
              <AgentContextBudgetBadge budget={contextBudget} summary={contextSummary} />
              {userActiveRun && userActiveRun.threadId !== activeThreadId ? (
                <AgentActiveRunHint message="另一会话正在运行，请等待结束后再提交" />
              ) : null}
              <AgentComposerRoot>
                <AgentComposerInput
                  placeholder={
                    submitBlocked && !modelDisabled
                      ? '已有进行中的 Agent 运行，请等待结束后再提交…'
                      : '描述你想让 Agent 完成的任务…'
                  }
                  disabled={submitBlocked}
                  maxLength={8000}
                />
                <AgentComposerFooter>
                  <AgentComposerActions>
                    <NewThreadButton onNewThread={startNewThread} />
                  </AgentComposerActions>
                  <AgentComposerSubmitGroup>
                    <ModelSelect
                      value={(selectedModel as TextModelId) || modelOptions[0]?.value || 'qwen3.7-plus'}
                      options={modelOptions}
                      disabled={modelDisabled}
                      boundHint={activeThreadId !== null}
                      onChange={handleModelChange}
                    />
                    <AgentStopButton />
                    <AuiIf condition={({ thread }) => !thread.isRunning && !submitBlocked}>
                      <AgentSendButton />
                    </AuiIf>
                    <AuiIf condition={({ thread }) => !thread.isRunning && submitBlocked}>
                      <AgentSendButtonDisabled />
                    </AuiIf>
                  </AgentComposerSubmitGroup>
                </AgentComposerFooter>
              </AgentComposerRoot>
              <AgentPrivacyNote />
            </AgentComposerDock>
          </AgentThreadRoot>
        </AgentConsolePanel>
      </AgentPageShell>
    </AssistantRuntimeProvider>
  )
}

function ThreadHydrator({
  skipHydrationRef,
  onContextBudget,
  onContextSummary,
  onCompressionEvent,
  onResetCompressionEvents,
}: {
  skipHydrationRef: { current: boolean }
  onContextBudget: (budget: AgentContextBudgetState | null) => void
  onContextSummary: (summary: AgentContextSummary | null) => void
  onCompressionEvent: (event: Extract<AgentStreamEvent, { type: 'context-compressed' }>) => void
  onResetCompressionEvents: () => void
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
          onContextBudget(null)
          onContextSummary(null)
          onResetCompressionEvents()
          return
        }
        const thread = await client.agent.threads.get(activeThreadId)
        if (cancelled) return
        setSelectedModel(thread.model)
        onContextSummary(thread.contextSummary)
        onContextBudget(null)
        onResetCompressionEvents()

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
            if (event.type === 'context-budget') onContextBudget(event)
            if (event.type === 'context-compressed') onCompressionEvent(event)
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
      resumeAbort.abort()
    }
  }, [activeThreadId])

  if (interruptedNotice) return <AgentInterruptedBanner message={interruptedNotice} />
  if (resumeNotice) return <AgentInterruptedBanner message={resumeNotice} />
  return null
}

function AgentContextBudgetBadge({
  budget,
  summary,
}: {
  budget: AgentContextBudgetState | null
  summary: AgentContextSummary | null
}) {
  if (!budget && !summary) return null
  const percentage = budget
    ? Math.min(999, Math.round((budget.usedTokens / Math.max(1, budget.usableTokens)) * 100))
    : null
  return (
    <details className="mx-1 rounded-xl border border-line/80 bg-surface-inset/60 px-3 py-2 text-xs text-ink-muted">
      <summary className="cursor-pointer select-none font-semibold text-ink">
        {percentage === null ? '上下文摘要可用' : `上下文 ${budget?.estimated ? '约 ' : ''}${percentage}% · ${budget?.level}`}
      </summary>
      {budget ? (
        <p className="mt-2 tabular-nums">
          {budget.usedTokens.toLocaleString()} / {budget.usableTokens.toLocaleString()} 可用 Token
          （模型窗口 {budget.contextWindowTokens.toLocaleString()}）
        </p>
      ) : null}
      {summary ? <AgentSummaryDetail summary={summary} /> : null}
    </details>
  )
}

function AgentContextTimeline({
  events,
  summary,
}: {
  events: Extract<AgentStreamEvent, { type: 'context-compressed' }>[]
  summary: AgentContextSummary | null
}) {
  if (events.length === 0) return null
  return (
    <div className="mx-auto w-full max-w-3xl space-y-2 px-4 pb-3" aria-label="上下文压缩时间线">
      {events.map((event) => (
        <details key={`${event.runId}-${event.sequence}`} className="rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-xs text-ink-muted">
          <summary className="cursor-pointer font-semibold text-ink">
            上下文已{event.level === 'forced' ? '强制摘要' : event.level === 'moderate' ? '中度压缩' : '轻量压缩'}
            {event.revision ? ` · 摘要 r${event.revision}` : ''}
          </summary>
          <p className="mt-1">{event.notes.join(' · ')}</p>
          {event.summaryId && summary?.id === event.summaryId ? <AgentSummaryDetail summary={summary} /> : null}
        </details>
      ))}
    </div>
  )
}

function AgentSummaryDetail({ summary }: { summary: AgentContextSummary }) {
  const content = summary.content
  return (
    <div className="mt-3 space-y-2 border-t border-line pt-2 text-left">
      <p>摘要 revision {summary.revision} · 覆盖至消息 #{summary.coveredThroughSequence}</p>
      <SummaryItems label="用户目标" values={content.userGoals} />
      <SummaryItems label="用户约束" values={content.userConstraints} />
      <SummaryItems label="开放问题" values={content.openQuestions} />
      <SummaryItems label="压缩说明" values={content.compressionNotes} />
      {content.recentOutcome ? <p><span className="font-semibold text-ink">最近结果：</span>{content.recentOutcome}</p> : null}
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-inset p-2 text-[0.68rem]">
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  )
}

function SummaryItems({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null
  return <p><span className="font-semibold text-ink">{label}：</span>{values.join('；')}</p>
}

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
        setUserActiveRun(run)
        void refreshThreads().catch(() => undefined)
      })
      .catch((error) => {
        handleAuthenticationFailure(error)
        setStopping(false)
      })
  }

  const className = cn(
    'grid h-9 w-auto place-items-center rounded-full bg-[#2c2540] px-3 text-[0.7rem] font-bold text-white transition-[background,transform] hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 dark:bg-surface-inset dark:text-ink',
    'focus-visible:outline-3 focus-visible:outline-brand-focus focus-visible:outline-offset-3',
  )

  if (isRunning) {
    return (
      <ComposerPrimitive.Cancel className={className} disabled={stopping} onClick={requestCancel}>
        {stopping ? '停止中…' : '停止'}
      </ComposerPrimitive.Cancel>
    )
  }

  return (
    <button type="button" className={className} disabled={stopping} onClick={requestCancel}>
      {stopping ? '停止中…' : '停止'}
    </button>
  )
}

const WebFetchToolUI = makeAssistantToolUI<
  { url?: string },
  { summary?: string; status?: string; audit?: Record<string, unknown> }
>({
  toolName: 'web_fetch',
  render: ({ args, result, status, isError }) => {
    const url = typeof args.url === 'string' ? args.url : ''
    const finalUrl = typeof result?.audit?.finalUrl === 'string' ? result.audit.finalUrl : undefined
    const httpStatus = typeof result?.audit?.status === 'number' ? result.audit.status : undefined

    if (status.type === 'running') return <AgentToolCall url={url} />

    return (
      <AgentToolResult
        isError={Boolean(isError)}
        status={result?.status ?? (isError ? 'failed' : 'succeeded')}
        httpStatus={httpStatus}
        summary={result?.summary}
        finalUrl={finalUrl}
      />
    )
  },
})

function AgentMessageMetadata() {
  const custom = useAuiState(({ message }) => message.metadata.custom) as AgentRunMetadataType
  return (
    <AgentRunMetadata
      model={custom.model}
      runStatus={custom.runStatus}
      totalTokens={custom.totalTokens}
      modelCalls={custom.modelCalls}
      toolCalls={custom.toolCalls}
    />
  )
}

function isTextModelAlias(value: string): value is TextModelAlias {
  return ['qwen', 'glm', 'deepseek', 'kimi'].includes(value)
}
