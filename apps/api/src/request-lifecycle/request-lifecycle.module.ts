import { Module } from '@nestjs/common'

import { DatabaseModule } from '../database/database.module'
import { RequestLifecycleService } from './request-lifecycle.service'

@Module({
  imports: [DatabaseModule],
  providers: [RequestLifecycleService],
  exports: [RequestLifecycleService],
})
export class RequestLifecycleModule {}
