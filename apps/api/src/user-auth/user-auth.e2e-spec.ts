import type { AddressInfo } from 'node:net'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { AppModule } from '../app.module'
import { configureApplication } from '../configure-app'
import { PrismaService } from '../database/prisma.service'
import { GITHUB_OAUTH_CLIENT } from './user-auth.constants'

describe('GitHub user authentication E2E', () => {
  let app: INestApplication
  let baseUrl: string
  let prisma: PrismaService
  const authenticate = jest.fn().mockResolvedValue({
    githubId: '12345678',
    githubUsername: 'octocat',
    displayName: 'The Octocat',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12345678?v=4',
    email: null,
  })

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GITHUB_OAUTH_CLIENT)
      .useValue({ authenticate })
      .compile()
    app = testingModule.createNestApplication()
    configureApplication(app)
    await app.listen(0, '127.0.0.1')
    const address = app.getHttpServer().address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    authenticate.mockClear()
    await prisma.userSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.userSession.deleteMany()
      await prisma.user.deleteMany()
    }
    if (app) await app.close()
  })

  it('completes fixture OAuth, persists a user/session, restores and logs out', async () => {
    const begin = await fetch(`${baseUrl}/api/v1/auth/github?returnTo=%2Fimage`, {
      redirect: 'manual',
    })
    expect(begin.status).toBe(302)
    const stateCookie = cookiePair(begin.headers.get('set-cookie'))
    const authorizeUrl = new URL(begin.headers.get('location') ?? '')
    const state = authorizeUrl.searchParams.get('state')
    expect(stateCookie).toContain('aigateway_oauth_state=')
    expect(state).toBeTruthy()

    const callback = await fetch(
      `${baseUrl}/api/v1/auth/github/callback?code=fixture-code&state=${encodeURIComponent(state ?? '')}`,
      { headers: { cookie: stateCookie }, redirect: 'manual' },
    )
    expect(callback.status).toBe(302)
    expect(callback.headers.get('location')).toBe('http://127.0.0.1:3000/image')
    const sessionCookie = cookiePair(callback.headers.get('set-cookie'), 'aigateway_user_session')
    expect(sessionCookie).toContain('aigateway_user_session=')

    await expect(prisma.user.findUnique({ where: { githubId: '12345678' } })).resolves.toMatchObject({
      githubUsername: 'octocat',
      email: null,
    })
    await expect(prisma.userSession.count()).resolves.toBe(1)

    const session = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { cookie: sessionCookie },
    })
    expect(session.status).toBe(200)
    await expect(session.json()).resolves.toMatchObject({
      user: { githubId: '12345678', githubUsername: 'octocat' },
    })

    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: sessionCookie },
    })
    expect(logout.status).toBe(201)
    await expect(prisma.userSession.count()).resolves.toBe(0)
  })
})

function cookiePair(value: string | null, preferredName?: string): string {
  if (!value) return ''
  const cookies = value.split(/,(?=\s*[^;,]+=)/)
  const selected = preferredName
    ? cookies.find((cookie) => cookie.trim().startsWith(`${preferredName}=`))
    : cookies[0]
  return selected?.trim().split(';')[0] ?? ''
}
