import { ZipFile } from 'yazl'

import {
  safeSkillMarkdownUrl,
  sanitizeSkillMarkdown,
  SkillPackageReadError,
  SkillPackageReader,
} from './skill-package-reader'
import { SkillZipInspectionError } from './skill-zip-inspector'

describe('SkillPackageReader', () => {
  it('reads only root SKILL.md and projects a file tree without script bodies', async () => {
    const scriptBody = 'process.env.SECRET_EXAMPLE'
    const archive = await zip([
      [
        'SKILL.md',
        [
          '# Cleaner',
          '<script>window.bad = true</script>',
          '<b>raw html</b>',
          '[safe](https://example.com/docs)',
          '[bad](javascript:alert(1))',
          '[ref][unsafe]',
          '[unsafe]: data:text/html;base64,PHNjcmlwdD4=',
        ].join('\n'),
      ],
      ['scripts/clean.mjs', scriptBody],
      ['references/notes.md', 'private reference body'],
    ])

    const result = await new SkillPackageReader().read(archive)

    expect(result.skillMarkdown).toContain('# Cleaner')
    expect(result.skillMarkdown).toContain('raw html')
    expect(result.skillMarkdown).toContain('[safe](https://example.com/docs)')
    expect(result.skillMarkdown).not.toMatch(/<script|<b>|window\.bad|javascript:|data:/i)
    expect(result.files).toEqual([
      { path: 'references/notes.md', type: 'file', size: 22 },
      { path: 'scripts/clean.mjs', type: 'file', size: 26 },
      { path: 'SKILL.md', type: 'file', size: 179 },
    ])
    expect(JSON.stringify(result)).not.toContain(scriptBody)
    expect(JSON.stringify(result)).not.toContain('private reference body')
  })

  it('rejects malformed UTF-8, binary controls and oversized SKILL.md', async () => {
    await expect(
      new SkillPackageReader().read(await zip([['SKILL.md', Buffer.from([0xc3, 0x28])]])),
    ).rejects.toMatchObject({ code: 'SKILL_MD_INVALID_UTF8' })
    await expect(
      new SkillPackageReader().read(await zip([['SKILL.md', Buffer.from('# ok\0binary')]])),
    ).rejects.toMatchObject({ code: 'SKILL_MD_BINARY' })
    await expect(
      new SkillPackageReader(undefined, 4).read(await zip([['SKILL.md', Buffer.from('12345')]])),
    ).rejects.toMatchObject({ code: 'SKILL_MD_SIZE_LIMIT' })
  })

  it('rejects path-traversal and damaged ZIP fixtures before reading content', async () => {
    const traversal = replaceEvery(
      await zip([
        ['SKILL.md', Buffer.from('# safe')],
        ['aa/evil.txt', Buffer.from('x')],
      ]),
      'aa/evil.txt',
      '../evil.txt',
    )
    await expect(new SkillPackageReader().read(traversal)).rejects.toMatchObject({
      code: 'ZIP_PATH_INVALID',
    })

    const valid = await zip([['SKILL.md', Buffer.from('# safe')]])
    await expect(
      new SkillPackageReader().read(valid.subarray(0, valid.length - 12)),
    ).rejects.toBeInstanceOf(SkillZipInspectionError)
  })

  it('sanitizes raw HTML and dangerous inline, reference and obfuscated protocols', () => {
    expect(safeSkillMarkdownUrl('https://example.com')).toBe('https://example.com')
    expect(safeSkillMarkdownUrl('/relative')).toBe('/relative')
    expect(safeSkillMarkdownUrl('java\nscript:alert(1)')).toBe('')
    expect(safeSkillMarkdownUrl('javascript&colon;alert(1)')).toBe('')
    expect(safeSkillMarkdownUrl('j&#97;vascript&#58;alert(1)')).toBe('')
    expect(safeSkillMarkdownUrl('java&NewLine;script:alert(1)')).toBe('')
    expect(() => safeSkillMarkdownUrl('&#999999999999999999999999;')).not.toThrow()
    expect(safeSkillMarkdownUrl('file:///etc/passwd')).toBe('')

    const sanitized = sanitizeSkillMarkdown(
      [
        '<style>.hidden { display: none }</style>',
        '<div>text</div>',
        '[bad](vbscript:msgbox)',
        '[data](data:text/html;base64,eA== "title")',
        '[safe](mailto:test@example.com)',
        '[ref][x]',
        '[x]: file:///etc/passwd "local"',
      ].join('\n'),
    )
    expect(sanitized).toContain('text')
    expect(sanitized).toContain('[safe](mailto:test@example.com)')
    expect(sanitized).not.toMatch(/<style|display: none|vbscript:|data:|file:/i)
  })

  it('uses typed errors for invalid text payloads', async () => {
    await expect(
      new SkillPackageReader().read(await zip([['SKILL.md', Buffer.from('<script>x</script>')]])),
    ).rejects.toBeInstanceOf(SkillPackageReadError)
  })
})

async function zip(files: Array<[path: string, content: string | Buffer]>): Promise<Buffer> {
  const archive = new ZipFile()
  for (const [path, content] of files) {
    archive.addBuffer(typeof content === 'string' ? Buffer.from(content) : content, path)
  }
  archive.end()
  const chunks: Buffer[] = []
  for await (const chunk of archive.outputStream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function replaceEvery(buffer: Buffer, from: string, to: string): Buffer {
  if (Buffer.byteLength(from) !== Buffer.byteLength(to)) throw new Error('fixture paths must match')
  const result = Buffer.from(buffer)
  const source = Buffer.from(from)
  const replacement = Buffer.from(to)
  let offset = 0
  let replacements = 0
  while ((offset = result.indexOf(source, offset)) !== -1) {
    replacement.copy(result, offset)
    offset += replacement.length
    replacements += 1
  }
  if (replacements < 2) throw new Error('fixture did not update local and central paths')
  return result
}
