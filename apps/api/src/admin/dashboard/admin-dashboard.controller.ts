import { Controller, Get } from '@nestjs/common'

import { AdminDashboardService } from './admin-dashboard.service'

@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('overview')
  overview() {
    return this.dashboard.overview()
  }

  @Get('trends')
  trends() {
    return this.dashboard.trends()
  }

  @Get('latencies')
  latencies() {
    return this.dashboard.latencies()
  }

  @Get('errors')
  errors() {
    return this.dashboard.errors()
  }
}
