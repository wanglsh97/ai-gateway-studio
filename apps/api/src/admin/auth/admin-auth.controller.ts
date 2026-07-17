import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'

import { ADMIN_SESSION_COOKIE, AdminAuthService } from './admin-auth.service'
import { AdminLoginDto } from './dto/admin-login.dto'

@Controller('admin/auth')
export class AdminAuthController {
  private readonly production: boolean

  constructor(
    private readonly auth: AdminAuthService,
    config: ConfigService,
  ) {
    this.production = config.get<string>('NODE_ENV') === 'production'
  }

  @Post('login')
  async login(@Body() input: AdminLoginDto, @Res({ passthrough: true }) response: Response) {
    this.auth.verifyCredentials(input.username, input.password)
    const { token, session } = await this.auth.createSession()
    response.cookie(ADMIN_SESSION_COOKIE, token, this.auth.cookieOptions(this.production))
    return session
  }

  @Get('session')
  session(@Req() request: Request) {
    return this.auth.readSession(request.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined)
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(ADMIN_SESSION_COOKIE, this.auth.cookieOptions(this.production, false))
    return { success: true }
  }
}
