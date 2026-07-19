import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'

import { USER_SESSION_COOKIE } from './user-auth.constants'
import { type AuthenticatedUser, UserSessionService } from './user-session.service'

export type UserRequest = Request & { currentUser?: AuthenticatedUser }

@Injectable()
export class UserSessionGuard implements CanActivate {
  constructor(private readonly sessions: UserSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<UserRequest>()
    request.currentUser = await this.sessions.read(readSessionCookie(request))
    return true
  }
}

export function readSessionCookie(request: Request): string | undefined {
  const cookies: unknown = request.cookies
  if (typeof cookies !== 'object' || cookies === null) return undefined
  const value = (cookies as Record<string, unknown>)[USER_SESSION_COOKIE]
  return typeof value === 'string' ? value : undefined
}
