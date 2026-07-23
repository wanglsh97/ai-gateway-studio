import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatFileSize, SKILL_CATEGORIES, validateSkillMetadata } from './skill-upload-form'

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

  it('formats the selected folder size', () => {
    assert.equal(formatFileSize(1024 * 1024), '1.0 MiB')
  })
})
