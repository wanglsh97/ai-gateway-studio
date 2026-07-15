import type {
  ChatEvent,
  ChatRequest,
  ImageRequest,
  ImageTask,
  ModelSummary,
  OptimizePromptRequest,
  OptimizePromptResult,
} from './types.js'

export interface RequestOptions {
  signal?: AbortSignal
}

export interface ImageWaitOptions extends RequestOptions {
  intervalMs?: number
  timeoutMs?: number
}

export interface AIGatewayClient {
  chat: {
    stream(input: ChatRequest, options?: RequestOptions): AsyncIterable<ChatEvent>
  }
  images: {
    create(input: ImageRequest, options?: RequestOptions): Promise<ImageTask>
    get(taskId: string, options?: RequestOptions): Promise<ImageTask>
    wait(taskId: string, options?: ImageWaitOptions): Promise<ImageTask>
    downloadUrl(taskId: string, index: number): string
  }
  prompts: {
    optimize(input: OptimizePromptRequest, options?: RequestOptions): Promise<OptimizePromptResult>
  }
  models: {
    list(options?: RequestOptions): Promise<ModelSummary[]>
  }
}
