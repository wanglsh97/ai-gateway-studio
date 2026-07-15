import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { ChatCompletionRequestDto } from './chat-completion-request.dto'

function dto(overrides: Record<string, unknown> = {}) {
  return plainToInstance(ChatCompletionRequestDto, {
    model: 'qwen',
    messages: [{ role: 'user', content: '你好' }],
    stream: true,
    ...overrides,
  })
}

describe('ChatCompletionRequestDto', () => {
  it('accepts the minimum streamed chat request', async () => {
    await expect(validate(dto())).resolves.toEqual([])
  })

  it('requires stream to be exactly true', async () => {
    await expect(validate(dto({ stream: false }))).resolves.not.toEqual([])
    await expect(validate(dto({ stream: undefined }))).resolves.not.toEqual([])
  })

  it('rejects unsupported aliases and invalid messages', async () => {
    await expect(validate(dto({ model: 'mock' }))).resolves.not.toEqual([])
    await expect(validate(dto({ messages: [] }))).resolves.not.toEqual([])
    await expect(validate(dto({ messages: [{ role: 'user', content: '' }] }))).resolves.not.toEqual(
      [],
    )
  })

  it('limits messages to 50 items and each content to 20,000 characters', async () => {
    const messages = Array.from({ length: 50 }, () => ({ role: 'user', content: '有效内容' }))

    await expect(validate(dto({ messages }))).resolves.toEqual([])
    await expect(
      validate(dto({ messages: [...messages, { role: 'user', content: '第 51 条' }] })),
    ).resolves.not.toEqual([])
    await expect(
      validate(dto({ messages: [{ role: 'user', content: 'x'.repeat(20_001) }] })),
    ).resolves.not.toEqual([])
  })

  it('enforces temperature, topP and maxTokens ranges', async () => {
    await expect(validate(dto({ temperature: 0, topP: 0, maxTokens: 1 }))).resolves.toEqual([])
    await expect(validate(dto({ temperature: 2, topP: 1, maxTokens: 4096 }))).resolves.toEqual([])
    await expect(validate(dto({ temperature: 2.01 }))).resolves.not.toEqual([])
    await expect(validate(dto({ topP: 1.01 }))).resolves.not.toEqual([])
    await expect(validate(dto({ maxTokens: 4097 }))).resolves.not.toEqual([])
  })
})
