import type { TextModelAlias, Usage } from '@aigateway/sdk'

export type ChatViewStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'cancelled' | 'error'

export interface ChatViewState {
  status: ChatViewStatus
  prompt: string
  response: string
  requestId?: string
  model?: TextModelAlias
  usage?: Usage
  error?: string
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
  prompt: '',
  response: '',
}

export function chatViewReducer(state: ChatViewState, action: ChatViewAction): ChatViewState {
  switch (action.type) {
    case 'submit':
      return { status: 'loading', prompt: action.prompt, response: '' }
    case 'started':
      if (state.status !== 'loading') return state
      return { ...state, requestId: action.requestId, model: action.model }
    case 'delta':
      if (state.status !== 'loading' && state.status !== 'streaming') return state
      return { ...state, status: 'streaming', response: state.response + action.content }
    case 'usage':
      if (state.status !== 'loading' && state.status !== 'streaming') return state
      return { ...state, usage: action.usage }
    case 'complete':
      if (state.status !== 'loading' && state.status !== 'streaming') return state
      return { ...state, status: 'success' }
    case 'cancel':
      if (state.status !== 'loading' && state.status !== 'streaming') return state
      return { ...state, status: 'cancelled' }
    case 'clear':
      return initialChatViewState
    case 'fail':
      if (state.status !== 'loading' && state.status !== 'streaming') return state
      return { ...state, status: 'error', error: action.message }
  }
}

export function readableChatError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return '暂时无法完成请求，请稍后重试。'
}
