import type { AddressInfo } from 'node:net'

import { createAIGatewayClient } from '@aigateway/sdk'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { AppModule } from '../app.module'
import { configureApplication } from '../configure-app'
import { PrismaService } from '../database/prisma.service'
import { RateLimitService } from '../rate-limit/rate-limit.service'

const databaseUrl = process.env.TEST_DATABASE_URL

describe('Public/admin Prompt privacy E2E', () => {
  let app: INestApplication
  let baseUrl: string
  let prisma: PrismaService

  beforeAll(async () => {
    if (!databaseUrl || (!databaseUrl.includes('_test') && !databaseUrl.includes('test_'))) {
      throw new Error('TEST_DATABASE_URL 必须指向名称包含 _test 或 test_ 的 PostgreSQL 测试库')
    }
    const testingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RateLimitService)
      .useValue({
        consumeChat: jest.fn().mockResolvedValue(undefined),
        consumeAdminLogin: jest.fn().mockResolvedValue(undefined),
      })
      .compile()
    app = testingModule.createNestApplication()
    configureApplication(app)
    await app.listen(0, '127.0.0.1')
    const address = app.getHttpServer().address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.adminAuditLog.deleteMany()
    await prisma.imageGenerationTask.deleteMany()
    await prisma.requestLog.deleteMany()
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.adminAuditLog.deleteMany()
      await prisma.imageGenerationTask.deleteMany()
      await prisma.requestLog.deleteMany()
    }
    if (app) await app.close()
  })

  it('keeps full Prompt out of aggregates and blocks every public admin data endpoint', async () => {
    const secretPrompt = 'PRIVATE_PROMPT_BOUNDARY_7f46d67d'
    await createAIGatewayClient({ baseUrl }).prompts.optimize({
      prompt: secretPrompt,
      mode: 'expand',
    })

    for (const path of [
      '/api/v1/admin/auth/session',
      '/api/v1/admin/dashboard/overview',
      '/api/v1/admin/dashboard/trends',
      '/api/v1/admin/dashboard/latencies',
      '/api/v1/admin/dashboard/errors',
      '/api/v1/admin/logs',
      '/api/v1/admin/tables',
    ]) {
      const response = await fetch(`${baseUrl}${path}`)
      expect(response.status).toBe(401)
    }

    const login = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'root', password: '123456' }),
    })
    expect(login.status).toBe(201)
    const cookie = login.headers.get('set-cookie')?.split(';')[0]
    expect(cookie).toBeTruthy()

    for (const path of ['overview', 'trends', 'latencies', 'errors']) {
      const response = await fetch(`${baseUrl}/api/v1/admin/dashboard/${path}`, {
        headers: { cookie: cookie ?? '' },
      })
      expect(response.status).toBe(200)
      expect(await response.text()).not.toContain(secretPrompt)
    }
  })
})
