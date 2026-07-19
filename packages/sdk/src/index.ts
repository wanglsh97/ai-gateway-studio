export { createAIGatewayClient } from './client.js'
export type {
  AIGatewayClient,
  ChatCompareRequest,
  ChatCompareRun,
  ChatCompareSession,
  CreateAIGatewayClientOptions,
  ImageWaitOptions,
  RequestOptions,
} from './client.js'
export {
  AIGatewayError,
  AIGatewayAuthenticationError,
  AIGatewayFeatureUnavailableError,
  AIGatewayProtocolError,
  AIGatewayTimeoutError,
} from './errors.js'
export {
  CHAT_SSE_DONE,
  IMAGE_MODEL_ALIASES,
  PROMPT_OPTIMIZATION_MODES,
  TEXT_MODEL_ALIASES,
} from './types.js'
export type {
  Capability,
  ChatEvent,
  ChatFinishReason,
  ChatMessage,
  ChatRequest,
  ChatSseDeltaPayload,
  ChatSseErrorPayload,
  ChatSsePayload,
  ChatSseUsagePayload,
  GatewayError,
  ImageModelAlias,
  ImageRequest,
  ImageResult,
  ImageTask,
  ImageTaskStatus,
  ModelAlias,
  ModelSummary,
  OptimizePromptRequest,
  OptimizePromptResult,
  PromptOptimizationMode,
  TextModelAlias,
  Usage,
} from './types.js'
