import { Inject, Controller, Get, Post, Query, Req, Res, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CookieOptions, Request, Response } from 'express'

import { GitHubOAuthClient } from './github-oauth.client'
import { OAuthStateService } from './oauth-state.service'
import { GITHUB_OAUTH_CLIENT, OAUTH_STATE_COOKIE, USER_SESSION_COOKIE } from './user-auth.constants'
import { UserSessionService } from './user-session.service'

@Controller('auth')
export class UserAuthController {
  private readonly enabled: boolean
  private readonly production: boolean
  private readonly clientId: string | undefined
  private readonly callbackUrl: string
  private readonly webOrigin: string
  private readonly sessionTtlSeconds: number

  constructor(
    @Inject(GITHUB_OAUTH_CLIENT) private readonly github: GitHubOAuthClient,
    private readonly oauthState: OAuthStateService,
    private readonly sessions: UserSessionService,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('GITHUB_OAUTH_ENABLED', false)
    this.production = config.get<string>('NODE_ENV') === 'production'
    this.clientId = config.get<string>('GITHUB_CLIENT_ID')
    this.callbackUrl = config.getOrThrow<string>('GITHUB_CALLBACK_URL')
    this.webOrigin = config.getOrThrow<string>('WEB_ORIGIN')
    this.sessionTtlSeconds = config.getOrThrow<number>('USER_SESSION_TTL_SECONDS')
  }

  @Get('github')
  beginGitHubLogin(
    @Query('returnTo') returnTo: string | undefined,
    @Res() response: Response,
  ): void {
    if (!this.enabled || !this.clientId) {
      throw new ServiceUnavailableException('GitHub 登录尚未配置')
    }
    const created = this.oauthState.create(returnTo)
    response.cookie(OAUTH_STATE_COOKIE, created.cookieValue, this.stateCookieOptions())

    const authorizeUrl = new URL('https://github.com/login/oauth/authorize')
    authorizeUrl.searchParams.set('client_id', this.clientId)
    authorizeUrl.searchParams.set('redirect_uri', this.callbackUrl)
    authorizeUrl.searchParams.set('scope', 'read:user user:email')
    authorizeUrl.searchParams.set('state', created.state)
    response.redirect(302, authorizeUrl.toString())
  }

  @Get('github/callback')
  async completeGitHubLogin(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const stateCookie = readCookie(request, OAUTH_STATE_COOKIE)
    response.clearCookie(OAUTH_STATE_COOKIE, this.stateCookieOptions(false))

    try {
      const returnTo = this.oauthState.verify(state, stateCookie)
      if (providerError || !code) {
        response.redirect(302, this.loginErrorUrl('authorization_rejected', returnTo))
        return
      }
      const identity = await this.github.authenticate(code)
      const session = await this.sessions.create(identity)
      response.cookie(USER_SESSION_COOKIE, session.token, this.sessionCookieOptions())
      response.redirect(302, new URL(returnTo, this.webOrigin).toString())
    } catch {
      response.redirect(302, this.loginErrorUrl('oauth_failed'))
    }
  }

  @Get('session')
  async readSession(@Req() request: Request) {
    const user = await this.sessions.read(readCookie(request, USER_SESSION_COOKIE))
    return { user }
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.sessions.revoke(readCookie(request, USER_SESSION_COOKIE))
    response.clearCookie(USER_SESSION_COOKIE, this.sessionCookieOptions(false))
    return { success: true }
  }

  private stateCookieOptions(includeMaxAge = true): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.production,
      path: '/api/v1/auth/github/callback',
      ...(includeMaxAge ? { maxAge: 10 * 60 * 1_000 } : {}),
    }
  }

  private sessionCookieOptions(includeMaxAge = true): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.production,
      path: '/api/v1',
      ...(includeMaxAge ? { maxAge: this.sessionTtlSeconds * 1_000 } : {}),
    }
  }

  private loginErrorUrl(error: string, returnTo = '/chat'): string {
    const url = new URL('/login', this.webOrigin)
    url.searchParams.set('error', error)
    url.searchParams.set('returnTo', returnTo)
    return url.toString()
  }
}

function readCookie(request: Request, name: string): string | undefined {
  const cookies: unknown = request.cookies
  if (typeof cookies !== 'object' || cookies === null) return undefined
  const value = (cookies as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : undefined
}
