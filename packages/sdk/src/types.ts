export const TEXT_MODEL_ALIASES = ['qwen', 'glm', 'deepseek', 'kimi'] as const
export const IMAGE_MODEL_ALIASES = ['wanxiang', 'cogview'] as const

export type TextModelAlias = (typeof TEXT_MODEL_ALIASES)[number]
export type ImageModelAlias = (typeof IMAGE_MODEL_ALIASES)[number]
export type ModelAlias = TextModelAlias | ImageModelAlias

export type Capability = 'chat' | 'image' | 'prompt'

export interface GatewayError {
  requestId: string
  code: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export interface Usage {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  estimatedCostCny: string | null
  usageUnknown: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  model: TextModelAlias
  messages: ChatMessage[]
  stream: true
  temperature?: number
  topP?: number
  maxTokens?: number
}

export type ChatFinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'unknown'

export interface ChatSseDeltaPayload {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: TextModelAlias
  request_id: string
  choices: Array<{
    index: number
    delta: {
      role?: 'assistant'
      content?: string
    }
    finish_reason: ChatFinishReason | null
  }>
}

export interface ChatSseUsagePayload {
  id: string
  object: 'chat.completion.usage'
  created: number
  model: TextModelAlias
  request_id: string
  choices: []
  usage: {
    prompt_tokens: number | null
    completion_tokens: number | null
    total_tokens: number | null
    aigateway: {
      estimated_cost_cny: string | null
      usage_unknown: boolean
    }
  }
}

export interface ChatSseErrorPayload {
  object: 'chat.completion.error'
  request_id: string
  error: GatewayError
}

export type ChatSsePayload = ChatSseDeltaPayload | ChatSseUsagePayload | ChatSseErrorPayload

export const CHAT_SSE_DONE = '[DONE]' as const

export type ChatEvent =
  | { type: 'start'; requestId: string; model: TextModelAlias }
  | { type: 'delta'; requestId: string; content: string }
  | { type: 'usage'; requestId: string; usage: Usage }
  | { type: 'error'; requestId: string; error: GatewayError }
  | { type: 'done'; requestId: string }

export type ImageTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export interface ImageRequest {
  model: ImageModelAlias
  prompt: string
  size?: string
  count?: number
}

export interface ImageResult {
  index: number
  width?: number
  height?: number
}

export interface ImageTask {
  taskId: string
  model: ImageModelAlias
  status: ImageTaskStatus
  results: ImageResult[]
  error?: GatewayError
}

export type PromptOptimizationMode = 'expand' | 'simplify' | 'structure'

export interface OptimizePromptRequest {
  prompt: string
  mode: PromptOptimizationMode
}

export interface OptimizePromptResult {
  requestId: string
  model: TextModelAlias
  optimizedPrompt: string
  usage: Usage
}

export interface ModelSummary {
  alias: ModelAlias
  capabilities: Capability[]
  displayName: string
  enabled: boolean
  configured: boolean
  health: 'unknown' | 'healthy' | 'unhealthy'
}
