import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { OptimizePromptDto } from './optimize-prompt.dto'

describe('OptimizePromptDto', () => {
  it.each(['expand', 'simplify', 'structure'])('accepts %s mode', async (mode) => {
    await expect(
      validate(plainToInstance(OptimizePromptDto, { prompt: '优化这段内容', mode })),
    ).resolves.toHaveLength(0)
  })

  it.each([1, 8_000])('accepts a prompt at the %i character boundary', async (length) => {
    await expect(
      validate(plainToInstance(OptimizePromptDto, { prompt: '文'.repeat(length), mode: 'expand' })),
    ).resolves.toHaveLength(0)
  })

  it.each([
    { prompt: '', mode: 'expand' },
    { prompt: '文'.repeat(8_001), mode: 'expand' },
    { prompt: '有效内容', mode: 'unknown' },
  ])('rejects invalid input %#', async (input) => {
    await expect(validate(plainToInstance(OptimizePromptDto, input))).resolves.not.toHaveLength(0)
  })
})
