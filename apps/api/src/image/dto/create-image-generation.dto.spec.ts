import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { CreateImageGenerationDto } from './create-image-generation.dto'

describe('CreateImageGenerationDto', () => {
  it('accepts a bounded provider-neutral image request', async () => {
    const dto = plainToInstance(CreateImageGenerationDto, {
      model: 'wanxiang',
      prompt: '水墨山水',
      size: '1024x1024',
      count: 1,
    })
    await expect(validate(dto)).resolves.toHaveLength(0)
  })

  it.each([
    { model: 'unknown', prompt: 'ok' },
    { model: 'cogview', prompt: '' },
    { model: 'cogview', prompt: 'ok', size: 'arbitrary' },
    { model: 'cogview', prompt: 'ok', count: 5 },
  ])('rejects invalid image input %#', async (input) => {
    await expect(
      validate(plainToInstance(CreateImageGenerationDto, input)),
    ).resolves.not.toHaveLength(0)
  })
})
