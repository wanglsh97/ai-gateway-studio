export type ChatViewStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error'

export interface ChatViewState {
  status: ChatViewStatus
  prompt: string
  response: string
  error?: string
}

export type ChatViewAction =
  | { type: 'submit'; prompt: string }
  | { type: 'delta'; content: string }
  | { type: 'complete' }
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
    case 'delta':
      if (state.status !== 'loading' && state.status !== 'streaming') return state
      return { ...state, status: 'streaming', response: state.response + action.content }
    case 'complete':
      if (state.status !== 'loading' && state.status !== 'streaming') return state
      return { ...state, status: 'success' }
    case 'fail':
      if (state.status !== 'loading' && state.status !== 'streaming') return state
      return { ...state, status: 'error', error: action.message }
  }
}

export function readableChatError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return '暂时无法完成请求，请稍后重试。'
}
