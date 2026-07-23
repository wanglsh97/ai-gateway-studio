import { createHash } from 'node:crypto'

import type { SkillPackageFixture } from './storage/in-memory-skill-object-store'

export const MOCK_EXECUTABLE_SKILL = Object.freeze({
  id: '00000000-0000-4000-8000-00000000a501',
  name: 'mock-data-cleaner',
  title: 'Mock 数据清洗',
  description: '使用确定性脚本清洗输入文本并生成结果文件。',
  category: 'development',
  owner: {
    id: '00000000-0000-4000-8000-00000000a500',
    githubId: 'system-skill-market',
    githubUsername: 'aigateway-skills',
  },
  objectKey: 'skills/mock-data-cleaner/package.zip',
  skillMarkdown:
    '# Mock Data Cleaner\n\nUse Shell to run `node scripts/clean.mjs` and export the result.',
})

const MOCK_ARCHIVE = new TextEncoder().encode('deterministic-mock-skill-package-v1')

export const MOCK_EXECUTABLE_SKILL_SHA256 = createHash('sha256').update(MOCK_ARCHIVE).digest('hex')

export const MOCK_EXECUTABLE_SKILL_PACKAGE = Object.freeze({
  objectKey: MOCK_EXECUTABLE_SKILL.objectKey,
  archive: MOCK_ARCHIVE,
  skillMarkdown: MOCK_EXECUTABLE_SKILL.skillMarkdown,
  files: [
    { path: 'SKILL.md', type: 'file', size: 89 },
    { path: 'scripts', type: 'directory', size: null },
    { path: 'scripts/clean.mjs', type: 'file', size: 128 },
  ] as const,
  updatedAt: '2000-01-01T00:00:00.000Z',
}) satisfies SkillPackageFixture
