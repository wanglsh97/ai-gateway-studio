'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type { TextModelAlias, TextModelId, Usage } from '@aigateway/sdk'
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useLocalRuntime,
} from '@assistant-ui/react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { createAgentChatAdapter } from './agent-chat-adapter'
import type { AgentChatOptions, AgentMessageMetadata } from './agent-chat-adapter'
import { AssistantMarkdown } from './assistant-markdown'
import { ProtectedUserPage } from '../../components/protected-user-page'
import { useAuthenticationFailure } from '../../components/use-authentication-failure'
import { CHAT_PROVIDER_BRANDING } from '../../config/chat-provider-branding'

const client = createAIGatewayClient()
const examples = ['解释什么是 API 网关', '为周末杭州之旅列一个计划', '用简单比喻介绍大语言模型']
interface ModelOption {
  value: TextModelId
  label: string
  provider: TextModelAlias
}
const fallbackModelOptions: ReadonlyArray<ModelOption> = [
  { value: 'kimi-k3', label: 'Kimi K3', provider: 'kimi' },
  { value: 'qwen3.7-plus', label: 'Qwen3.7-Plus', provider: 'qwen' },
  { value: 'glm-5.2', label: 'GLM-5.2', provider: 'glm' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek-V4-Pro', provider: 'deepseek' },
]

export default function ChatPage() {
  return (
    <ProtectedUserPage>
      <ChatContent />
    </ProtectedUserPage>
  )
}

function ChatContent() {
  const handleAuthenticationFailure = useAuthenticationFailure()
  const [selectedModel, setSelectedModel] = useState<TextModelId>('kimi-k3')
  const [modelOptions, setModelOptions] = useState(fallbackModelOptions)
  const [modelError, setModelError] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(0.9)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const optionsRef = useRef<AgentChatOptions>({
    model: selectedModel,
    modelName: modelOptions.find(({ value }) => value === selectedModel)?.label ?? selectedModel,
    temperature,
    topP,
    maxTokens,
  })
  optionsRef.current = {
    model: selectedModel,
    modelName: modelOptions.find(({ value }) => value === selectedModel)?.label ?? selectedModel,
    temperature,
    topP,
    maxTokens,
  }

  const adapter = useMemo(
    () =>
      createAgentChatAdapter(
        client,
        () => optionsRef.current,
        (error) => {
          handleAuthenticationFailure(error)
        },
      ),
    [handleAuthenticationFailure],
  )
  const runtime = useLocalRuntime(adapter)

  useEffect(() => {
    let active = true
    void client.models
      .list()
      .then((models) => {
        if (!active) return
        const enabled = models.flatMap((model) =>
          model.enabled && model.capabilities.includes('chat') && isTextModelAlias(model.alias)
            ? [{ value: model.id, label: model.displayName, provider: model.alias }]
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

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main className="agent-page">
        <section className="agent-console agent-chat-panel" aria-label="对话 Agent">
          <AgentThread
            modelDisabled={modelOptions.length === 0}
            modelError={modelError}
            modelOptions={modelOptions}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            settingsOpen={settingsOpen}
            onSettingsToggle={() => setSettingsOpen((open) => !open)}
            temperature={temperature}
            onTemperatureChange={setTemperature}
            topP={topP}
            onTopPChange={setTopP}
            maxTokens={maxTokens}
            onMaxTokensChange={setMaxTokens}
          />
        </section>
      </main>
    </AssistantRuntimeProvider>
  )
}

interface AgentThreadProps {
  modelDisabled: boolean
  modelError: string
  modelOptions: ReadonlyArray<ModelOption>
  selectedModel: TextModelId
  onModelChange: (model: TextModelId) => void
  settingsOpen: boolean
  onSettingsToggle: () => void
  temperature: number
  onTemperatureChange: (value: number) => void
  topP: number
  onTopPChange: (value: number) => void
  maxTokens: number
  onMaxTokensChange: (value: number) => void
}

function AgentThread({
  modelDisabled,
  modelError,
  modelOptions,
  selectedModel,
  onModelChange,
  settingsOpen,
  onSettingsToggle,
  temperature,
  onTemperatureChange,
  topP,
  onTopPChange,
  maxTokens,
  onMaxTokensChange,
}: AgentThreadProps) {
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
        <ComposerPrimitive.Root className="agent-composer">
          {modelError && (
            <p role="alert" className="agent-composer-error">
              {modelError}
            </p>
          )}
          {settingsOpen && (
            <section aria-label="生成参数" className="agent-composer-parameters">
              <Parameter
                label="Temperature"
                value={temperature}
                min={0}
                max={2}
                step={0.1}
                onChange={onTemperatureChange}
              />
              <Parameter
                label="Top P"
                value={topP}
                min={0}
                max={1}
                step={0.05}
                onChange={onTopPChange}
              />
              <Parameter
                label="Max tokens"
                value={maxTokens}
                min={1}
                max={4096}
                step={1}
                onChange={onMaxTokensChange}
              />
            </section>
          )}
          <ComposerPrimitive.Input
            aria-label="输入消息"
            rows={1}
            maxLength={4000}
            disabled={modelDisabled}
            placeholder="交给 Agent 一个任务…"
          />
          <div className="agent-composer-footer">
            <div className="agent-composer-actions">
              <Link href="/chat/compare" className="agent-composer-action">
                模型对比
              </Link>
              <button
                type="button"
                className="agent-composer-action"
                onClick={onSettingsToggle}
                aria-expanded={settingsOpen}
              >
                参数
                <span aria-hidden="true">{settingsOpen ? '−' : '+'}</span>
              </button>
              <NewThreadButton />
            </div>
            <div className="agent-composer-submit-group">
              <ModelSelect
                value={selectedModel}
                options={modelOptions}
                disabled={modelDisabled}
                onChange={onModelChange}
              />
              <AuiIf condition={({ thread }) => thread.isRunning}>
                <ComposerPrimitive.Cancel className="agent-send-button is-cancel">
                  停止
                </ComposerPrimitive.Cancel>
              </AuiIf>
              <AuiIf condition={({ thread }) => !thread.isRunning}>
                <ComposerPrimitive.Send
                  className="agent-send-button"
                  disabled={modelDisabled}
                  aria-label="发送消息"
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20">
                    <path d="M10 15V5m0 0L6 9m4-4 4 4" />
                  </svg>
                </ComposerPrimitive.Send>
              </AuiIf>
            </div>
          </div>
        </ComposerPrimitive.Root>
        <p className="agent-privacy-note">内容由 AI 生成，请仔细甄别</p>
      </div>
    </ThreadPrimitive.Root>
  )
}

function ModelSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: TextModelId
  options: ReadonlyArray<ModelOption>
  disabled: boolean
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
        aria-label={`运行模型：${selectedLabel}`}
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
          <p>运行模型</p>
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
  return (
    <div className="agent-empty-state">
      <div className="agent-orbit" aria-hidden="true">
        <span>AI</span>
      </div>
      <p className="agent-empty-kicker">CURRENT THREAD · EMPTY</p>
      <h2>从一个清晰的问题开始</h2>
      <p>Agent 会携带这条会话中的上下文，持续给出流式回应。</p>
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
        <div className="agent-message-label">AI GATEWAY · AGENT RESPONSE</div>
        <div className="agent-assistant-content">
          <MessagePrimitive.Parts>
            {({ part }) =>
              part.type === 'text' ? <AssistantMarkdown>{part.text}</AssistantMarkdown> : null
            }
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
  const custom = useAuiState(({ message }) => message.metadata.custom) as AgentMessageMetadata
  const status = useAuiState(({ message }) => message.status)
  const usage = custom.usage
  return (
    <p>
      {custom.model ?? '模型'} · {status?.type === 'running' ? '生成中' : usageLabel(usage)}
      {usage?.estimatedCostCny ? ` · ¥${usage.estimatedCostCny}` : ''}
      {custom.requestId ? ` · ${custom.requestId}` : ''}
    </p>
  )
}

function NewThreadButton() {
  const api = useAui()
  const hasMessages = useAuiState(({ thread }) => thread.messages.length > 0)
  if (!hasMessages) return null
  return (
    <button type="button" className="agent-composer-action" onClick={() => api.thread().reset()}>
      新会话
    </button>
  )
}

function usageLabel(usage?: Usage): string {
  if (!usage) return '等待用量'
  return usage.usageUnknown ? 'Token 未知' : `${usage.totalTokens} tokens`
}

function isTextModelAlias(value: string): value is TextModelAlias {
  return ['qwen', 'glm', 'deepseek', 'kimi'].includes(value)
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
    <label>
      <span>
        <b>{label}</b>
        <output>{value}</output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
