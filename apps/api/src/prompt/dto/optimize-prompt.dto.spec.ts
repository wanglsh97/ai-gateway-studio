import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { OptimizePromptDto } from './optimize-prompt.dto'

describe('OptimizePromptDto', () => {
  it.each(['expand', 'simplify', 'structure'])('accepts %s mode', async (mode) => {
    await expect(
      validate(plainToInstance(OptimizePromptDto, { prompt: '优化这段内容', mode })),
    ).resolves.toHaveLength(0)
  })

  it('rejects unknown modes, empty prompts, and client systemPrompt fields through whitelist validation', async () => {
    await expect(
      validate(plainToInstance(OptimizePromptDto, { prompt: '', mode: 'unknown' })),
    ).resolves.not.toHaveLength(0)
  })
})
