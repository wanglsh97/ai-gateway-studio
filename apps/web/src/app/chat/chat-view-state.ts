import type { TextModelAlias, Usage } from '@aigateway/sdk'

export type ChatViewStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'cancelled' | 'error'

export interface ChatViewMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  status?: Exclude<ChatViewStatus, 'idle'>
  requestId?: string
  model?: TextModelAlias
  usage?: Usage
  error?: string
}

export interface ChatViewState {
  status: ChatViewStatus
  messages: readonly ChatViewMessage[]
  nextMessageId: number
}

export type ChatViewAction =
  | { type: 'submit'; prompt: string }
  | { type: 'started'; requestId: string; model: TextModelAlias }
  | { type: 'delta'; content: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'complete' }
  | { type: 'cancel' }
  | { type: 'clear' }
  | { type: 'fail'; message: string }

export const initialChatViewState: ChatViewState = {
  status: 'idle',
  messages: [],
  nextMessageId: 1,
}

export function chatViewReducer(state: ChatViewState, action: ChatViewAction): ChatViewState {
  switch (action.type) {
    case 'submit':
      return {
        status: 'loading',
        messages: [
          ...state.messages,
          { id: state.nextMessageId, role: 'user', content: action.prompt },
          {
            id: state.nextMessageId + 1,
            role: 'assistant',
            content: '',
            status: 'loading',
          },
        ],
        nextMessageId: state.nextMessageId + 2,
      }
    case 'started':
      if (state.status !== 'loading') return state
      return updateActiveAssistant(state, {
        requestId: action.requestId,
        model: action.model,
      })
    case 'delta':
      if (!isGenerating(state.status)) return state
      return updateActiveAssistant(
        { ...state, status: 'streaming' },
        { content: activeAssistant(state).content + action.content, status: 'streaming' },
      )
    case 'usage':
      if (!isGenerating(state.status)) return state
      return updateActiveAssistant(state, { usage: action.usage })
    case 'complete':
      if (!isGenerating(state.status)) return state
      return updateActiveAssistant({ ...state, status: 'success' }, { status: 'success' })
    case 'cancel':
      if (!isGenerating(state.status)) return state
      return updateActiveAssistant({ ...state, status: 'cancelled' }, { status: 'cancelled' })
    case 'clear':
      return initialChatViewState
    case 'fail':
      if (!isGenerating(state.status)) return state
      return updateActiveAssistant(
        { ...state, status: 'error' },
        { status: 'error', error: action.message },
      )
  }
}

function isGenerating(status: ChatViewStatus): boolean {
  return status === 'loading' || status === 'streaming'
}

function activeAssistant(state: ChatViewState): ChatViewMessage {
  const message = state.messages.at(-1)
  if (!message || message.role !== 'assistant')
    throw new Error('Active assistant message is missing')
  return message
}

function updateActiveAssistant(
  state: ChatViewState,
  patch: Partial<ChatViewMessage>,
): ChatViewState {
  const active = activeAssistant(state)
  return {
    ...state,
    messages: [...state.messages.slice(0, -1), { ...active, ...patch }],
  }
}

export function readableChatError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return '暂时无法完成请求，请稍后重试。'
}
