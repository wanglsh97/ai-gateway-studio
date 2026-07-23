import { randomUUID } from 'node:crypto'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { AppModule } from '../../../app.module'
import { PrismaService } from '../../../database/prisma.service'
import { cleanupUserTestData } from '../../../user-auth/user-auth.e2e-helpers'
import { SkillPublishingService } from './skill-publishing.service'

describe('Skill publishing claim PostgreSQL E2E', () => {
  let app: INestApplication
  let prisma: PrismaService
  let service: SkillPublishingService

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
    service = app.get(SkillPublishingService)
  })

  beforeEach(async () => {
    await cleanupUserTestData(prisma)
  })

  afterAll(async () => {
    if (prisma) await cleanupUserTestData(prisma)
    if (app) await app.close()
  })

  it('allows exactly one concurrent global-name claimant and binds ownership', async () => {
    const [userA, userB] = await Promise.all([createUser(prisma, 'a'), createUser(prisma, 'b')])
    const [uploadA, uploadB] = await Promise.all([
      createFinalizedUpload(prisma, userA.id, 'a'),
      createFinalizedUpload(prisma, userB.id, 'b'),
    ])
    const submit = (userId: string, uploadSessionId: string) =>
      service.claim(userId, {
        uploadSessionId,
        name: 'global-cleaner',
        title: 'Global Cleaner',
        description: 'Cleans deterministic fixtures.',
        category: 'data',
      })

    const results = await Promise.allSettled([
      submit(userA.id, uploadA.id),
      submit(userB.id, uploadB.id),
    ])

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof submit>>> =>
        result.status === 'fulfilled',
    )
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.reason).toMatchObject({ code: 'SKILL_NAME_TAKEN' })
    await expect(prisma.skill.count({ where: { name: 'global-cleaner' } })).resolves.toBe(1)
    await expect(
      service.requireOwner(fulfilled[0]!.value.ownerId, 'global-cleaner'),
    ).resolves.toMatchObject({
      id: fulfilled[0]!.value.id,
    })
    const losingUserId = fulfilled[0]!.value.ownerId === userA.id ? userB.id : userA.id
    await expect(service.requireOwner(losingUserId, 'global-cleaner')).rejects.toMatchObject({
      code: 'SKILL_NOT_OWNER',
    })
  })

  it('consumes one finalized upload once and enforces the database category constraint', async () => {
    const user = await createUser(prisma, 'single')
    const upload = await createFinalizedUpload(prisma, user.id, 'single')
    await service.claim(user.id, {
      uploadSessionId: upload.id,
      name: 'first-name',
      title: 'First',
      description: 'First claim.',
      category: 'development',
    })
    await expect(
      service.claim(user.id, {
        uploadSessionId: upload.id,
        name: 'second-name',
        title: 'Second',
        description: 'Second claim.',
        category: 'development',
      }),
    ).rejects.toMatchObject({ code: 'SKILL_UPLOAD_NOT_FINALIZED' })
    await expect(
      prisma.skill.create({
        data: {
          name: 'invalid-category',
          ownerId: user.id,
          title: 'Invalid',
          description: 'Invalid category.',
          category: 'custom',
        },
      }),
    ).rejects.toThrow()
  })
})

async function createUser(prisma: PrismaService, suffix: string) {
  return prisma.user.create({
    data: {
      githubId: `claim-${suffix}-${randomUUID().slice(0, 8)}`,
      githubUsername: `claim-${suffix}`,
      lastLoginAt: new Date(),
    },
  })
}

async function createFinalizedUpload(prisma: PrismaService, userId: string, suffix: string) {
  const id = randomUUID()
  return prisma.skillUploadSession.create({
    data: {
      id,
      userId,
      objectKey: `skill-staging/${userId}/${id}/package-${suffix}.zip`,
      status: 'FINALIZED',
      expectedContentType: 'application/zip',
      expectedSizeBytes: 10n,
      expectedSha256: 'a'.repeat(64),
      observedSizeBytes: 10n,
      observedSha256: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 300_000),
      finalizedAt: new Date(),
    },
  })
}
