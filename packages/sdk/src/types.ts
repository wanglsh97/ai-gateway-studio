export type TextModelAlias = 'qwen' | 'glm' | 'deepseek'
export type ImageModelAlias = 'wanxiang' | 'cogview'
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
  maxTokens?: number
}

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
