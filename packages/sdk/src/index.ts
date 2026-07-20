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
export { decodeAgentEvent, encodeAgentEvent } from './agent-events.js'
export type { AgentEventWire } from './agent-events.js'
export type { AgentClient, AgentEventSubscribeOptions, AgentThreadListOptions } from './agent-client.js'
export {
  AGENT_EVENT_SSE_DONE,
  AGENT_MESSAGE_ROLES,
  AGENT_RUN_LIMIT_REASONS,
  AGENT_RUN_STATUSES,
  AGENT_RUN_TERMINAL_STATUSES,
  AGENT_TOOL_CALL_STATUSES,
} from './agent-types.js'
export type {
  AgentMessage,
  AgentMessagePart,
  AgentMessageRole,
  AgentReasoningPart,
  AgentRunLimitReason,
  AgentRunStatus,
  AgentRunSummary,
  AgentRunTerminalStatus,
  AgentRunUsage,
  AgentStreamEvent,
  AgentTextPart,
  AgentThread,
  AgentThreadListPage,
  AgentThreadSummary,
  AgentToolCallPart,
  AgentToolCallStatus,
  AgentToolResultPart,
  CreateAgentRunRequest,
  CreateAgentThreadRequest,
  UpdateAgentThreadRequest,
} from './agent-types.js'
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
  TextModelId,
  Usage,
} from './types.js'
