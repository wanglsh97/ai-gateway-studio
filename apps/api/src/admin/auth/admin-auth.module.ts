import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { RateLimitModule } from '../../rate-limit/rate-limit.module'
import { AdminAuthController } from './admin-auth.controller'
import { AdminAuthService } from './admin-auth.service'

@Module({
  imports: [JwtModule.register({}), RateLimitModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
