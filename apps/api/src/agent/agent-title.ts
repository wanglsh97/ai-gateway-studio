import { AGENT_DEFAULT_THREAD_TITLE, AGENT_DERIVED_TITLE_MAX_LENGTH } from './agent.constants'

/**
 * 从用户首条输入派生会话标题：压缩空白，超长截断并加省略号。
 * 空输入回退到默认标题。
 */
export function deriveAgentThreadTitle(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim()
  if (normalized.length === 0) return AGENT_DEFAULT_THREAD_TITLE
  if (normalized.length <= AGENT_DERIVED_TITLE_MAX_LENGTH) return normalized
  return `${normalized.slice(0, AGENT_DERIVED_TITLE_MAX_LENGTH)}…`
}
