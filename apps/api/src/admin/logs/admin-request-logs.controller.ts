import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'

import { AdminRequestLogsService } from './admin-request-logs.service'
import { RequestLogQueryDto } from './dto/request-log-query.dto'

@Controller('admin/logs')
export class AdminRequestLogsController {
  constructor(private readonly logs: AdminRequestLogsService) {}

  @Get()
  list(@Query() query: RequestLogQueryDto) {
    return this.logs.list(query)
  }

  @Get(':requestId')
  detail(@Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string) {
    return this.logs.detail(requestId)
  }
}
