import { Module } from '@nestjs/common'

import { ChatModule } from '../../chat/chat.module'
import { AdminDashboardController } from './admin-dashboard.controller'
import { AdminDashboardService } from './admin-dashboard.service'

@Module({
  imports: [ChatModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
