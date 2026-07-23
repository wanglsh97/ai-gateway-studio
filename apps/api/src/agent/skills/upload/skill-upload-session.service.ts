import { randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  SKILL_OBJECT_STORE_PORT,
  type SkillObjectStorePort,
} from '../storage/skill-object-store.port'
import {
  SKILL_UPLOAD_SIGNER_PORT,
  type SignedSkillUpload,
  type SkillUploadSignerPort,
} from './skill-upload-signer.port'
import {
  SkillUploadSessionRepository,
  type SkillUploadSessionRecord,
  type SkillUploadSessionRepositoryPort,
} from './skill-upload-session.repository'

export const MAX_SKILL_PACKAGE_BYTES = 20 * 1024 * 1024
export const SKILL_UPLOAD_CONTENT_TYPE = 'application/zip' as const
export const SKILL_UPLOAD_CLOCK = Symbol('SKILL_UPLOAD_CLOCK')

export interface CreateSkillUploadSessionInput {
  sizeBytes: number
  sha256: string
  skillName?: string
}

export interface CreatedSkillUploadSession {
  session: SkillUploadSessionRecord
  upload: SignedSkillUpload
}

@Injectable()
export class SkillUploadSessionService {
  private readonly ttlSeconds: number
  private readonly cleanupBatchSize: number

  constructor(
    @Inject(SkillUploadSessionRepository)
    private readonly repository: SkillUploadSessionRepositoryPort,
    @Inject(SKILL_UPLOAD_SIGNER_PORT) private readonly signer: SkillUploadSignerPort,
    @Inject(SKILL_OBJECT_STORE_PORT) private readonly objects: SkillObjectStorePort,
    @Inject(ConfigService) config: ConfigService,
    @Inject(SKILL_UPLOAD_CLOCK) private readonly now: () => Date,
  ) {
    this.ttlSeconds = config.get<number>('SKILL_UPLOAD_TTL_SECONDS') ?? 300
    this.cleanupBatchSize = config.get<number>('SKILL_STAGING_CLEANUP_BATCH') ?? 100
  }

  async create(
    userId: string,
    input: CreateSkillUploadSessionInput,
  ): Promise<CreatedSkillUploadSession> {
    validateUpload(input)
    const id = randomUUID()
    const target =
      input.skillName === undefined
        ? null
        : await this.repository.findPublishedTarget(input.skillName, userId)
    if (input.skillName !== undefined && !target) {
      throw new SkillUploadSessionError(
        'UPLOAD_SKILL_NOT_PUBLISHED_OR_OWNER',
        '只能覆盖自己已发布的 Skill',
      )
    }
    const objectKey = target?.packageObjectKey ?? `skill-staging/${userId}/${id}/package.zip`
    const expiresAt = new Date(this.now().getTime() + this.ttlSeconds * 1_000)
    const session = await this.repository.create({
      id,
      userId,
      ...(target === null ? {} : { skillId: target.id }),
      objectKey,
      expectedContentType: SKILL_UPLOAD_CONTENT_TYPE,
      expectedSizeBytes: BigInt(input.sizeBytes),
      expectedSha256: input.sha256,
      expiresAt,
    })
    try {
      const upload = await this.signer.signSkillUpload({
        objectKey,
        contentType: SKILL_UPLOAD_CONTENT_TYPE,
        contentLength: input.sizeBytes,
        sha256: input.sha256,
        expiresInSeconds: this.ttlSeconds,
      })
      return { session, upload }
    } catch (error) {
      await this.repository.abandon(id, userId, this.now(), boundedError(error, '上传签名失败'))
      throw error
    }
  }

  async finalize(userId: string, sessionId: string): Promise<SkillUploadSessionRecord> {
    const session = await this.requireOwned(userId, sessionId)
    if (session.status === 'FINALIZED') return session
    if (session.status === 'ABANDONED') {
      throw new SkillUploadSessionError('UPLOAD_SESSION_ABANDONED', '上传会话已废弃')
    }
    if (session.expiresAt <= this.now()) {
      await this.repository.abandon(session.id, userId, this.now(), '上传会话已过期')
      throw new SkillUploadSessionError('UPLOAD_SESSION_EXPIRED', '上传会话已过期')
    }

    const metadata = await this.objects.statObject(session.objectKey)
    if (!metadata) {
      throw new SkillUploadSessionError('UPLOAD_OBJECT_MISSING', '尚未找到已上传的 Skill 包')
    }
    const invalid =
      metadata.kind !== 'skill-package' ||
      metadata.contentType !== session.expectedContentType ||
      metadata.sizeBytes !== Number(session.expectedSizeBytes) ||
      metadata.sizeBytes > MAX_SKILL_PACKAGE_BYTES ||
      metadata.sha256 !== session.expectedSha256
    if (invalid) {
      await this.repository.abandon(session.id, userId, this.now(), 'OSS 对象元数据不匹配')
      throw new SkillUploadSessionError(
        'UPLOAD_OBJECT_MISMATCH',
        '上传对象的类型、大小或 SHA-256 与会话不一致',
      )
    }
    const finalized = await this.repository.finalize(
      session.id,
      userId,
      { sizeBytes: BigInt(metadata.sizeBytes), sha256: metadata.sha256 },
      this.now(),
    )
    if (
      finalized.status !== 'FINALIZED' ||
      finalized.observedSizeBytes !== session.expectedSizeBytes ||
      finalized.observedSha256 !== session.expectedSha256
    ) {
      throw new SkillUploadSessionError('UPLOAD_FINALIZE_CONFLICT', '上传会话状态发生冲突')
    }
    return finalized
  }

  async cleanupAbandoned(): Promise<{ claimed: number; cleaned: number; pending: number }> {
    const sessions = await this.repository.claimExpired(this.now(), this.cleanupBatchSize)
    let cleaned = 0
    for (const session of sessions) {
      try {
        if (session.skillId === null) await this.objects.deleteObject(session.objectKey)
        await this.repository.finishCleanup(session.id, true, null)
        cleaned += 1
      } catch (error) {
        await this.repository.finishCleanup(
          session.id,
          false,
          boundedError(error, 'OSS staging 清理失败'),
        )
      }
    }
    return { claimed: sessions.length, cleaned, pending: sessions.length - cleaned }
  }

  private async requireOwned(userId: string, sessionId: string): Promise<SkillUploadSessionRecord> {
    const session = await this.repository.findOwned(sessionId, userId)
    if (!session) throw new SkillUploadSessionError('UPLOAD_SESSION_NOT_FOUND', '上传会话不存在')
    return session
  }
}

export class SkillUploadSessionError extends Error {
  readonly retryable = false

  constructor(
    readonly code:
      | 'UPLOAD_SESSION_NOT_FOUND'
      | 'UPLOAD_SESSION_ABANDONED'
      | 'UPLOAD_SESSION_EXPIRED'
      | 'UPLOAD_OBJECT_MISSING'
      | 'UPLOAD_OBJECT_MISMATCH'
      | 'UPLOAD_FINALIZE_CONFLICT'
      | 'UPLOAD_SKILL_NOT_PUBLISHED_OR_OWNER',
    message: string,
  ) {
    super(message)
    this.name = 'SkillUploadSessionError'
  }
}

function validateUpload(input: CreateSkillUploadSessionInput): void {
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MAX_SKILL_PACKAGE_BYTES
  ) {
    throw new SkillUploadSessionError(
      'UPLOAD_OBJECT_MISMATCH',
      `Skill ZIP 必须在 1 到 ${MAX_SKILL_PACKAGE_BYTES} 字节之间`,
    )
  }
  if (!/^[a-f0-9]{64}$/.test(input.sha256)) {
    throw new SkillUploadSessionError('UPLOAD_OBJECT_MISMATCH', 'SHA-256 格式无效')
  }
}

function boundedError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback
  return message.slice(0, 500)
}
