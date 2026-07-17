import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'

import { AdminAuthController } from './admin-auth.controller'
import { ADMIN_SESSION_COOKIE } from './admin-auth.service'
import type { AdminAuthService } from './admin-auth.service'
import type { RateLimitService } from '../../rate-limit/rate-limit.service'

function setup() {
  const verifyCredentials = jest.fn()
  const createSession = jest.fn().mockResolvedValue({
    token: 'signed-token',
    session: { username: 'root', expiresAt: '2026-07-17T12:00:00.000Z' },
  })
  const readSession = jest
    .fn()
    .mockResolvedValue({ username: 'root', expiresAt: '2026-07-17T12:00:00.000Z' })
  const cookieOptions = jest.fn((_production: boolean, includeMaxAge = true) => ({
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    path: '/api/v1/admin',
    ...(includeMaxAge ? { maxAge: 900_000 } : {}),
  }))
  const auth = {
    verifyCredentials,
    createSession,
    readSession,
    cookieOptions,
  } as unknown as AdminAuthService
  const consumeAdminLogin = jest.fn().mockResolvedValue(undefined)
  const rateLimit = { consumeAdminLogin } as unknown as RateLimitService
  const controller = new AdminAuthController(
    auth,
    rateLimit,
    new ConfigService({ NODE_ENV: 'test' }),
  )
  const response = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response
  const request = { ip: '203.0.113.10' } as unknown as Request
  return {
    consumeAdminLogin,
    controller,
    createSession,
    readSession,
    request,
    response,
    verifyCredentials,
  }
}

describe('AdminAuthController', () => {
  it('sets the signed session cookie after successful login', async () => {
    const { consumeAdminLogin, controller, request, response, verifyCredentials } = setup()

    await expect(
      controller.login({ username: 'root', password: '123456' }, request, response),
    ).resolves.toEqual({ username: 'root', expiresAt: '2026-07-17T12:00:00.000Z' })
    expect(verifyCredentials).toHaveBeenCalledWith('root', '123456')
    expect(consumeAdminLogin).toHaveBeenCalledWith('203.0.113.10')
    expect(consumeAdminLogin.mock.invocationCallOrder[0]).toBeLessThan(
      verifyCredentials.mock.invocationCallOrder[0] ?? 0,
    )
    expect(response.cookie).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      'signed-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    )
  })

  it('reads the cookie for session queries and clears it on logout', async () => {
    const { controller, readSession, response } = setup()
    const request = {
      cookies: { [ADMIN_SESSION_COOKIE]: 'signed-token' },
    } as unknown as Request

    await expect(controller.session(request)).resolves.toMatchObject({ username: 'root' })
    expect(readSession).toHaveBeenCalledWith('signed-token')
    expect(controller.logout(response)).toEqual({ success: true })
    expect(response.clearCookie).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      expect.not.objectContaining({ maxAge: expect.anything() }),
    )
  })

  it('does not verify credentials or set a cookie when the login limit rejects', async () => {
    const { consumeAdminLogin, controller, request, response, verifyCredentials } = setup()
    consumeAdminLogin.mockRejectedValue(new Error('rate limited'))

    await expect(
      controller.login({ username: 'root', password: '123456' }, request, response),
    ).rejects.toThrow('rate limited')
    expect(verifyCredentials).not.toHaveBeenCalled()
    expect(response.cookie).not.toHaveBeenCalled()
  })
})
