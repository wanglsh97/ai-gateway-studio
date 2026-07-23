import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '../../../database/prisma.service'

export type SkillUploadSessionStatus = 'PENDING_UPLOAD' | 'FINALIZED' | 'ABANDONED'
export type ObjectCleanupStatus = 'NONE' | 'PENDING' | 'SUCCEEDED'

export interface SkillUploadSessionRecord {
  id: string
  userId: string
  skillId: string | null
  objectKey: string
  status: SkillUploadSessionStatus
  cleanupStatus: ObjectCleanupStatus
  expectedContentType: string
  expectedSizeBytes: bigint
  expectedSha256: string
  observedSizeBytes: bigint | null
  observedSha256: string | null
  expiresAt: Date
  finalizedAt: Date | null
  abandonedAt: Date | null
  cleanupAttempts: number
  cleanupError: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSkillUploadSessionRecord {
  id: string
  userId: string
  skillId?: string
  objectKey: string
  expectedContentType: string
  expectedSizeBytes: bigint
  expectedSha256: string
  expiresAt: Date
}

export interface PublishedSkillUploadTarget {
  id: string
  packageObjectKey: string
}

export interface SkillUploadSessionRepositoryPort {
  create(input: CreateSkillUploadSessionRecord): Promise<SkillUploadSessionRecord>
  findPublishedTarget(name: string, userId: string): Promise<PublishedSkillUploadTarget | null>
  findOwned(id: string, userId: string): Promise<SkillUploadSessionRecord | null>
  finalize(
    id: string,
    userId: string,
    observed: { sizeBytes: bigint; sha256: string },
    now: Date,
  ): Promise<SkillUploadSessionRecord>
  abandon(id: string, userId: string, now: Date, error: string | null): Promise<void>
  claimExpired(now: Date, limit: number): Promise<SkillUploadSessionRecord[]>
  finishCleanup(id: string, succeeded: boolean, error: string | null): Promise<void>
}

@Injectable()
export class SkillUploadSessionRepository implements SkillUploadSessionRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(input: CreateSkillUploadSessionRecord): Promise<SkillUploadSessionRecord> {
    return this.prisma.skillUploadSession.create({ data: input })
  }

  findPublishedTarget(name: string, userId: string): Promise<PublishedSkillUploadTarget | null> {
    return this.prisma.skill
      .findFirst({
        where: {
          name,
          ownerId: userId,
          status: 'PUBLISHED',
          packageObjectKey: { not: null },
        },
        select: { id: true, packageObjectKey: true },
      })
      .then((skill) =>
        skill?.packageObjectKey ? { id: skill.id, packageObjectKey: skill.packageObjectKey } : null,
      )
  }

  findOwned(id: string, userId: string): Promise<SkillUploadSessionRecord | null> {
    return this.prisma.skillUploadSession.findFirst({ where: { id, userId } })
  }

  async finalize(
    id: string,
    userId: string,
    observed: { sizeBytes: bigint; sha256: string },
    now: Date,
  ): Promise<SkillUploadSessionRecord> {
    return this.prisma.$transaction(async (tx) => {
      await tx.skillUploadSession.updateMany({
        where: { id, userId, status: 'PENDING_UPLOAD', expiresAt: { gt: now } },
        data: {
          status: 'FINALIZED',
          observedSizeBytes: observed.sizeBytes,
          observedSha256: observed.sha256,
          finalizedAt: now,
        },
      })
      return tx.skillUploadSession.findFirstOrThrow({ where: { id, userId } })
    })
  }

  async abandon(id: string, userId: string, now: Date, error: string | null): Promise<void> {
    await this.prisma.skillUploadSession.updateMany({
      where: { id, userId, status: 'PENDING_UPLOAD' },
      data: {
        status: 'ABANDONED',
        cleanupStatus: 'PENDING',
        abandonedAt: now,
        cleanupError: error,
      },
    })
  }

  async claimExpired(now: Date, limit: number): Promise<SkillUploadSessionRecord[]> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.skillUploadSession.findMany({
        where: { status: 'PENDING_UPLOAD', expiresAt: { lte: now } },
        orderBy: { expiresAt: 'asc' },
        take: limit,
      })
      if (expired.length > 0) {
        const ids = expired.map((session) => session.id)
        await tx.skillUploadSession.updateMany({
          where: { id: { in: ids }, status: 'PENDING_UPLOAD' },
          data: {
            status: 'ABANDONED',
            cleanupStatus: 'PENDING',
            abandonedAt: now,
          },
        })
      }
      return tx.skillUploadSession.findMany({
        where: { status: 'ABANDONED', cleanupStatus: 'PENDING' },
        orderBy: { updatedAt: 'asc' },
        take: limit,
      })
    })
  }

  async finishCleanup(id: string, succeeded: boolean, error: string | null): Promise<void> {
    await this.prisma.skillUploadSession.update({
      where: { id },
      data: {
        cleanupStatus: succeeded ? 'SUCCEEDED' : 'PENDING',
        cleanupAttempts: { increment: 1 },
        cleanupError: error,
      },
    })
  }
}
