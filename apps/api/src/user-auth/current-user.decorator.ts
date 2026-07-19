import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthenticatedUser } from './user-session.service'
import type { UserRequest } from './user-session.guard'

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<UserRequest>()
    if (!request.currentUser) throw new Error('CurrentUser requires UserSessionGuard')
    return request.currentUser
  },
)
