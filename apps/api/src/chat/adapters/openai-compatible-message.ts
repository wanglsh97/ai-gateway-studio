import type { ChatAdapterMessage } from './chat-adapter'

/** 将平台消息映射为 OpenAI-compatible wire message，保留 reasoning 与 tool loop 历史。 */
export function toOpenAICompatibleMessages(messages: readonly ChatAdapterMessage[]): unknown[] {
  return messages.map((message) => {
    if (message.role === 'assistant') {
      return {
        role: message.role,
        content: message.content,
        ...(message.reasoningContent ? { reasoning_content: message.reasoningContent } : {}),
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
              })),
            }
          : {}),
      }
    }
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
        ...(message.toolName ? { name: message.toolName } : {}),
      }
    }
    return { role: message.role, content: message.content }
  })
}
