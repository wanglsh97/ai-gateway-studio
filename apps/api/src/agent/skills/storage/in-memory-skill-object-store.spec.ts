import { createHash } from 'node:crypto'

import { InMemorySkillObjectStore } from './in-memory-skill-object-store'

describe('InMemorySkillObjectStore', () => {
  it('loads a deterministic package snapshot with metadata, SKILL.md and sorted file tree', async () => {
    const archive = Uint8Array.from([1, 2, 3, 4])
    const store = new InMemorySkillObjectStore({
      skillPackages: [
        {
          objectKey: 'skills/data-cleaner/package.zip',
          archive,
          skillMarkdown: '# Data Cleaner',
          files: [
            { path: 'scripts/clean.mjs', type: 'file', size: 42 },
            { path: 'SKILL.md', type: 'file', size: 14 },
            { path: 'scripts', type: 'directory', size: null },
          ],
        },
      ],
    })

    archive[0] = 99
    const loaded = await store.loadSkillPackage('skills/data-cleaner/package.zip')

    expect(loaded).toMatchObject({
      metadata: {
        objectKey: 'skills/data-cleaner/package.zip',
        kind: 'skill-package',
        contentType: 'application/zip',
        sizeBytes: 4,
        sha256: createHash('sha256')
          .update(Uint8Array.from([1, 2, 3, 4]))
          .digest('hex'),
        updatedAt: '2000-01-01T00:00:00.000Z',
      },
      skillMarkdown: '# Data Cleaner',
    })
    expect(loaded?.files.map((file) => file.path)).toEqual([
      'scripts',
      'scripts/clean.mjs',
      'SKILL.md',
    ])
    expect([...loaded!.archive]).toEqual([1, 2, 3, 4])
  })

  it('keeps input and output fixtures isolated and returns defensive byte copies', async () => {
    const store = new InMemorySkillObjectStore({
      now: () => new Date('2026-07-23T12:00:00.000Z'),
      userFiles: [
        {
          objectKey: 'user-files/user-1/input.csv',
          direction: 'input',
          fileName: 'input.csv',
          bytes: new TextEncoder().encode('a,b\n1,2\n'),
          contentType: 'text/csv',
        },
      ],
    })

    const input = await store.loadUserFile('user-files/user-1/input.csv')
    input!.bytes[0] = 0
    expect(
      new TextDecoder().decode((await store.loadUserFile(input!.metadata.objectKey))!.bytes),
    ).toBe('a,b\n1,2\n')

    const output = await store.writeUserFile({
      objectKey: 'user-files/user-1/result.csv',
      direction: 'output',
      fileName: 'result.csv',
      contentType: 'text/csv',
      bytes: new TextEncoder().encode('ok\n'),
    })
    expect(output.metadata).toMatchObject({
      kind: 'user-output',
      sizeBytes: 3,
      updatedAt: '2026-07-23T12:00:00.000Z',
    })
    expect(await store.loadSkillPackage(output.metadata.objectKey)).toBeNull()
    expect(await store.statObject(output.metadata.objectKey)).toEqual(output.metadata)
  })

  it('supports aborts, missing objects and idempotent deletion', async () => {
    const store = new InMemorySkillObjectStore()
    const controller = new AbortController()
    const reason = new Error('cancelled by test')
    controller.abort(reason)

    await expect(store.statObject('missing')).resolves.toBeNull()
    await expect(store.loadUserFile('missing')).resolves.toBeNull()
    await expect(store.deleteObject('missing')).resolves.toBeUndefined()
    await expect(store.statObject('missing', controller.signal)).rejects.toBe(reason)
  })

  it('rejects duplicate fixture paths and unsafe object keys', () => {
    expect(
      () =>
        new InMemorySkillObjectStore({
          skillPackages: [
            {
              objectKey: 'skills/duplicate/package.zip',
              archive: new Uint8Array(),
              skillMarkdown: '# Duplicate',
              files: [
                { path: 'SKILL.md', type: 'file', size: 1 },
                { path: 'SKILL.md', type: 'file', size: 1 },
              ],
            },
          ],
        }),
    ).toThrow('duplicate Skill fixture path')

    expect(
      () =>
        new InMemorySkillObjectStore({
          userFiles: [
            {
              objectKey: '../outside',
              direction: 'input',
              fileName: 'x',
              bytes: new Uint8Array(),
            },
          ],
        }),
    ).toThrow('Invalid object key')
  })
})
