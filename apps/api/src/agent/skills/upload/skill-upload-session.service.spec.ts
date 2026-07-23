import { ConfigService } from '@nestjs/config'

import { InMemorySkillObjectStore } from '../storage/in-memory-skill-object-store'
import { InMemorySkillUploadSigner } from './in-memory-skill-upload-signer'
import type {
  CreateSkillUploadSessionRecord,
  SkillUploadSessionRecord,
  SkillUploadSessionRepositoryPort,
} from './skill-upload-session.repository'
import {
  MAX_SKILL_PACKAGE_BYTES,
  SkillUploadSessionError,
  SkillUploadSessionService,
} from './skill-upload-session.service'

const clock = new Date('2026-07-23T12:00:00.000Z')

describe('SkillUploadSessionService', () => {
  it('issues a short-lived private PUT scoped to one staging object', async () => {
    const fixture = createFixture()
    const created = await fixture.service.create('user-1', {
      sizeBytes: 4,
      sha256: 'a'.repeat(64),
    })

    expect(created.session.objectKey).toMatch(
      /^skill-staging\/user-1\/[0-9a-f-]{36}\/package\.zip$/,
    )
    expect(created.session.expiresAt.toISOString()).toBe('2026-07-23T12:05:00.000Z')
    expect(created.upload).toMatchObject({
      method: 'PUT',
      headers: {
        'content-type': 'application/zip',
        'x-oss-object-acl': 'private',
        'x-oss-meta-kind': 'skill-package',
        'x-oss-meta-sha256': 'a'.repeat(64),
      },
    })
    expect(created.upload.url).not.toContain('access-key')
  })

  it('validates package size and SHA-256 before issuing a signature', async () => {
    const { service } = createFixture()
    await expect(
      service.create('user-1', { sizeBytes: MAX_SKILL_PACKAGE_BYTES + 1, sha256: 'a'.repeat(64) }),
    ).rejects.toBeInstanceOf(SkillUploadSessionError)
    await expect(
      service.create('user-1', { sizeBytes: 1, sha256: '../invalid' }),
    ).rejects.toBeInstanceOf(SkillUploadSessionError)
  })

  it('finalizes matching OSS metadata idempotently and rejects cross-user access', async () => {
    const fixture = createFixture()
    const archive = Uint8Array.from([1, 2, 3, 4])
    const sha256 = '9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a'
    const created = await fixture.service.create('user-1', { sizeBytes: 4, sha256 })
    fixture.objects.seedSkillPackage({
      objectKey: created.session.objectKey,
      archive,
      skillMarkdown: '# Test',
      files: [],
    })

    const first = await fixture.service.finalize('user-1', created.session.id)
    const second = await fixture.service.finalize('user-1', created.session.id)
    expect(first).toMatchObject({
      status: 'FINALIZED',
      observedSizeBytes: 4n,
      observedSha256: sha256,
    })
    expect(second).toEqual(first)
    await expect(fixture.service.finalize('user-2', created.session.id)).rejects.toMatchObject({
      code: 'UPLOAD_SESSION_NOT_FOUND',
    })
  })

  it('marks mismatched and expired sessions abandoned and cleans staging idempotently', async () => {
    const fixture = createFixture()
    const mismatch = await fixture.service.create('user-1', {
      sizeBytes: 3,
      sha256: 'a'.repeat(64),
    })
    fixture.objects.seedSkillPackage({
      objectKey: mismatch.session.objectKey,
      archive: Uint8Array.from([1, 2, 3]),
      skillMarkdown: '# Test',
      files: [],
    })
    await expect(fixture.service.finalize('user-1', mismatch.session.id)).rejects.toMatchObject({
      code: 'UPLOAD_OBJECT_MISMATCH',
    })

    fixture.advance(301_000)
    const expired = await fixture.service.create('user-1', {
      sizeBytes: 1,
      sha256: 'b'.repeat(64),
    })
    fixture.advance(301_000)
    const result = await fixture.service.cleanupAbandoned()
    expect(result).toEqual({ claimed: 2, cleaned: 2, pending: 0 })
    expect(fixture.repository.get(mismatch.session.id)?.cleanupStatus).toBe('SUCCEEDED')
    expect(fixture.repository.get(expired.session.id)).toMatchObject({
      status: 'ABANDONED',
      cleanupStatus: 'SUCCEEDED',
      cleanupAttempts: 1,
    })
  })
})

function createFixture() {
  let nowMs = clock.getTime()
  const now = () => new Date(nowMs)
  const repository = new MemoryUploadRepository(now)
  const objects = new InMemorySkillObjectStore({ now })
  const service = new SkillUploadSessionService(
    repository as never,
    new InMemorySkillUploadSigner(now),
    objects,
    new ConfigService({
      SKILL_UPLOAD_TTL_SECONDS: 300,
      SKILL_STAGING_CLEANUP_BATCH: 100,
    }),
    now,
  )
  return {
    service,
    repository,
    objects,
    advance: (milliseconds: number) => {
      nowMs += milliseconds
    },
  }
}

class MemoryUploadRepository implements SkillUploadSessionRepositoryPort {
  private readonly records = new Map<string, SkillUploadSessionRecord>()

  constructor(private readonly now: () => Date) {}

  get(id: string): SkillUploadSessionRecord | undefined {
    return this.records.get(id)
  }

  async create(input: CreateSkillUploadSessionRecord): Promise<SkillUploadSessionRecord> {
    const timestamp = this.now()
    const record: SkillUploadSessionRecord = {
      ...input,
      status: 'PENDING_UPLOAD',
      cleanupStatus: 'NONE',
      observedSizeBytes: null,
      observedSha256: null,
      finalizedAt: null,
      abandonedAt: null,
      cleanupAttempts: 0,
      cleanupError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.records.set(record.id, record)
    return record
  }

  async findOwned(id: string, userId: string): Promise<SkillUploadSessionRecord | null> {
    const record = this.records.get(id)
    return record?.userId === userId ? record : null
  }

  async finalize(
    id: string,
    userId: string,
    observed: { sizeBytes: bigint; sha256: string },
    now: Date,
  ): Promise<SkillUploadSessionRecord> {
    const record = await this.findOwned(id, userId)
    if (!record) throw new Error('missing')
    if (record.status === 'PENDING_UPLOAD' && record.expiresAt > now) {
      Object.assign(record, {
        status: 'FINALIZED',
        observedSizeBytes: observed.sizeBytes,
        observedSha256: observed.sha256,
        finalizedAt: now,
        updatedAt: now,
      })
    }
    return record
  }

  async abandon(id: string, userId: string, now: Date, error: string | null): Promise<void> {
    const record = await this.findOwned(id, userId)
    if (record?.status !== 'PENDING_UPLOAD') return
    Object.assign(record, {
      status: 'ABANDONED',
      cleanupStatus: 'PENDING',
      abandonedAt: now,
      cleanupError: error,
      updatedAt: now,
    })
  }

  async claimExpired(now: Date, limit: number): Promise<SkillUploadSessionRecord[]> {
    for (const record of this.records.values()) {
      if (record.status === 'PENDING_UPLOAD' && record.expiresAt <= now) {
        await this.abandon(record.id, record.userId, now, null)
      }
    }
    return [...this.records.values()]
      .filter((record) => record.status === 'ABANDONED' && record.cleanupStatus === 'PENDING')
      .slice(0, limit)
  }

  async finishCleanup(id: string, succeeded: boolean, error: string | null): Promise<void> {
    const record = this.records.get(id)
    if (!record) return
    record.cleanupStatus = succeeded ? 'SUCCEEDED' : 'PENDING'
    record.cleanupAttempts += 1
    record.cleanupError = error
  }
}
