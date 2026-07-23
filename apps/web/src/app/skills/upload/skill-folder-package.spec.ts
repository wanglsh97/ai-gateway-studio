import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { unzipSync } from 'fflate'

import {
  parseSkillFrontmatter,
  prepareSkillFolder,
  type SkillFolderFile,
} from './skill-folder-package'

describe('Skill folder package preparation', () => {
  it('reads YAML defaults and strips the selected outer folder from the ZIP', async () => {
    const prepared = await prepareSkillFolder([
      folderFile(
        'csv-cleaner/SKILL.md',
        [
          '---',
          'name: csv-cleaner',
          'description: >-',
          '  Clean and normalize CSV files.',
          '---',
          '',
          '# CSV Cleaner',
        ].join('\n'),
      ),
      folderFile('csv-cleaner/scripts/clean.sh', '#!/bin/sh\necho clean\n'),
    ])

    assert.equal(prepared.name, 'csv-cleaner')
    assert.equal(prepared.title, 'csv-cleaner')
    assert.equal(prepared.description, 'Clean and normalize CSV files.')
    assert.equal(prepared.folderName, 'csv-cleaner')
    assert.equal(prepared.fileCount, 2)

    const archive = unzipSync(new Uint8Array(await prepared.archive.arrayBuffer()))
    assert.deepEqual(Object.keys(archive).sort(), ['SKILL.md', 'scripts/clean.sh'])
  })

  it('requires SKILL.md at the selected folder root', async () => {
    await assert.rejects(
      prepareSkillFolder([
        folderFile(
          'csv-cleaner/docs/SKILL.md',
          '---\nname: csv-cleaner\ndescription: CSV helper\n---\n',
        ),
      ]),
      /根目录必须包含 SKILL\.md/,
    )
  })

  it('rejects missing and malformed YAML identity metadata', () => {
    assert.throws(() => parseSkillFrontmatter('# No frontmatter'), /frontmatter/)
    assert.throws(
      () => parseSkillFrontmatter('---\nname: CSV Cleaner\ndescription: helper\n---\n'),
      /小写字母/,
    )
    assert.throws(() => parseSkillFrontmatter('---\nname: csv-cleaner\n---\n'), /缺少 description/)
  })
})

function folderFile(path: string, content: string): SkillFolderFile {
  const bytes = new TextEncoder().encode(content)
  return {
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    name: path.split('/').at(-1) ?? path,
    size: bytes.byteLength,
    text: async () => content,
    webkitRelativePath: path,
  }
}
