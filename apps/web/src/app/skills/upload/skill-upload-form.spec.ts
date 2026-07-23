import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatFileSize,
  MAX_SKILL_ICON_BYTES,
  SKILL_CATEGORIES,
  validateSkillIconFile,
  validateSkillMetadata,
  validateSkillPackageFile,
} from './skill-upload-form'

describe('Skill upload form validation', () => {
  it('accepts fixed categories and valid market metadata', () => {
    assert.deepEqual(
      validateSkillMetadata({
        name: 'csv-cleaner',
        title: 'CSV 清洗助手',
        description: '检测并修复常见表格问题。',
        category: SKILL_CATEGORIES[1].value,
      }),
      {},
    )
  })

  it('rejects malformed names, unknown categories and bounded text', () => {
    const errors = validateSkillMetadata({
      name: '../Unsafe',
      title: '',
      description: 'x'.repeat(241),
      category: 'custom',
    })
    assert.deepEqual(Object.keys(errors).sort(), ['category', 'description', 'name', 'title'])
  })

  it('enforces ZIP and icon type/size boundaries', () => {
    assert.equal(
      validateSkillPackageFile({ name: 'skill.zip', size: 1024, type: 'application/zip' }),
      null,
    )
    assert.match(
      validateSkillPackageFile({ name: 'skill.tar', size: 1024, type: 'application/x-tar' }) ?? '',
      /\.zip/,
    )
    assert.match(
      validateSkillPackageFile({
        name: 'skill.zip',
        size: 21 * 1024 * 1024,
        type: 'application/zip',
      }) ?? '',
      /20 MiB/,
    )
    assert.equal(
      validateSkillIconFile({ name: 'icon.webp', size: MAX_SKILL_ICON_BYTES, type: 'image/webp' }),
      null,
    )
    assert.match(
      validateSkillIconFile({ name: 'icon.svg', size: 100, type: 'image/svg+xml' }) ?? '',
      /PNG/,
    )
    assert.equal(formatFileSize(1024 * 1024), '1.0 MiB')
  })
})
