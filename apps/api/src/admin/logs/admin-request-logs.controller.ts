import { Controller, Get, Query } from '@nestjs/common'

import { AdminRequestLogsService } from './admin-request-logs.service'
import { RequestLogQueryDto } from './dto/request-log-query.dto'

@Controller('admin/logs')
export class AdminRequestLogsController {
  constructor(private readonly logs: AdminRequestLogsService) {}

  @Get()
  list(@Query() query: RequestLogQueryDto) {
    return this.logs.list(query)
  }
}
