import { CHAT_ADAPTER_IDS, TEXT_MODEL_ALIASES, isTextModelAlias } from './chat.constants'

describe('chat constants', () => {
  it('keeps the public text aliases stable', () => {
    expect(TEXT_MODEL_ALIASES).toEqual(['qwen', 'glm', 'deepseek'])
    expect(CHAT_ADAPTER_IDS).toEqual(['mock', 'qwen', 'glm', 'deepseek'])
  })

  it('recognizes only public text aliases', () => {
    expect(isTextModelAlias('qwen')).toBe(true)
    expect(isTextModelAlias('mock')).toBe(false)
    expect(isTextModelAlias('unknown')).toBe(false)
  })
})
