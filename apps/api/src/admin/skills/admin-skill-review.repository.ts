import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '../../database/prisma.service'

export type SkillReviewOutcome = 'approved' | 'rejected'

export interface PendingSkillReviewRecord {
  id: string
  name: string
  title: string
  description: string
  category: string
  ownerId: string
  packageSha256: string | null
  status: 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'DELISTED'
  createdAt: Date
  updatedAt: Date
}

export interface AdminSkillReviewRepositoryPort {
  listPending(): Promise<PendingSkillReviewRecord[]>
  decide(
    skillId: string,
    outcome: SkillReviewOutcome,
    reason: string | null,
    reviewer: string,
    now: Date,
  ): Promise<PendingSkillReviewRecord>
}

const REVIEW_SKILL_SELECT = {
  id: true,
  name: true,
  title: true,
  description: true,
  category: true,
  ownerId: true,
  packageSha256: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class AdminSkillReviewRepository implements AdminSkillReviewRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listPending(): Promise<PendingSkillReviewRecord[]> {
    return this.prisma.skill.findMany({
      where: { status: 'PENDING_REVIEW' },
      select: REVIEW_SKILL_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
  }

  async decide(
    skillId: string,
    outcome: SkillReviewOutcome,
    reason: string | null,
    reviewer: string,
    now: Date,
  ): Promise<PendingSkillReviewRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.skill.findUnique({
        where: { id: skillId },
        select: REVIEW_SKILL_SELECT,
      })
      if (!current) throw new SkillReviewPersistenceError('SKILL_NOT_FOUND', 'Skill 不存在')
      if (current.status !== 'PENDING_REVIEW') {
        throw new SkillReviewPersistenceError(
          'SKILL_REVIEW_INVALID_TRANSITION',
          `Skill 当前状态 ${current.status} 不能再次审核`,
        )
      }
      if (!current.packageSha256) {
        throw new SkillReviewPersistenceError(
          'SKILL_PACKAGE_MISSING',
          'Skill 没有可审核的资源包哈希',
        )
      }
      const changed = await tx.skill.updateMany({
        where: { id: skillId, status: 'PENDING_REVIEW' },
        data:
          outcome === 'approved'
            ? { status: 'PUBLISHED', publishedAt: now, delistedAt: null }
            : { status: 'REJECTED', publishedAt: null },
      })
      if (changed.count !== 1) {
        throw new SkillReviewPersistenceError(
          'SKILL_REVIEW_INVALID_TRANSITION',
          'Skill 审核状态已被其他请求更新',
        )
      }
      await tx.skillReview.create({
        data: {
          skillId,
          reviewer,
          decision: outcome === 'approved' ? 'APPROVED' : 'REJECTED',
          reason,
          packageSha256: current.packageSha256,
        },
      })
      return tx.skill.findUniqueOrThrow({ where: { id: skillId }, select: REVIEW_SKILL_SELECT })
    })
  }
}

export class SkillReviewPersistenceError extends Error {
  constructor(
    readonly code: 'SKILL_NOT_FOUND' | 'SKILL_REVIEW_INVALID_TRANSITION' | 'SKILL_PACKAGE_MISSING',
    message: string,
  ) {
    super(message)
    this.name = 'SkillReviewPersistenceError'
  }
}
