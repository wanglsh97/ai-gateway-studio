import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { CreateAgentRunDto } from './create-agent-run.dto'

describe('CreateAgentRunDto', () => {
  it('accepts up to 50 globally named manual Skills', async () => {
    const dto = plainToInstance(CreateAgentRunDto, {
      input: '执行任务',
      skills: [{ name: 'mock-data-cleaner' }],
    })
    await expect(validate(dto)).resolves.toEqual([])
  })

  it('rejects malformed, nested-extra and excessive selections', async () => {
    const malformed = plainToInstance(CreateAgentRunDto, {
      input: '执行任务',
      skills: [{ name: '../unsafe', extra: true }],
    })
    expect(
      (await validate(malformed, { whitelist: true, forbidNonWhitelisted: true })).length,
    ).toBeGreaterThan(0)

    const excessive = plainToInstance(CreateAgentRunDto, {
      input: '执行任务',
      skills: Array.from({ length: 51 }, (_, index) => ({ name: `skill-${index}` })),
    })
    expect(await validate(excessive)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'skills' })]),
    )
  })
})
