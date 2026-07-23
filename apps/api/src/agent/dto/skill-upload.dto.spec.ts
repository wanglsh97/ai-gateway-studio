import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

import { MAX_SKILL_PACKAGE_BYTES } from '../skills/upload/skill-upload-session.service'
import { CreateSkillUploadSessionDto } from './skill-upload.dto'

describe('CreateSkillUploadSessionDto', () => {
  it('accepts bounded size and lowercase SHA-256 metadata', async () => {
    const dto = plainToInstance(CreateSkillUploadSessionDto, {
      sizeBytes: MAX_SKILL_PACKAGE_BYTES,
      sha256: 'a'.repeat(64),
    })
    await expect(validate(dto)).resolves.toEqual([])
  })

  it.each([
    { sizeBytes: 0, sha256: 'a'.repeat(64) },
    { sizeBytes: MAX_SKILL_PACKAGE_BYTES + 1, sha256: 'a'.repeat(64) },
    { sizeBytes: 1, sha256: 'A'.repeat(64) },
    { sizeBytes: 1, sha256: '../unsafe' },
  ])('rejects invalid upload metadata %#', async (input) => {
    const dto = plainToInstance(CreateSkillUploadSessionDto, input)
    expect(await validate(dto)).not.toEqual([])
  })
})
