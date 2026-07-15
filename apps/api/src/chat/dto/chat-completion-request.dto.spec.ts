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
})
