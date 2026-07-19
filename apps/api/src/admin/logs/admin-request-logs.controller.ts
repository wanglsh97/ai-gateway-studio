import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiCookieAuth, ApiQuery, ApiTags } from '@nestjs/swagger'

import { ADMIN_SESSION_COOKIE } from '../auth/admin-auth.service'
import { AdminRequestLogsService } from './admin-request-logs.service'
import { RequestLogQueryDto } from './dto/request-log-query.dto'

@ApiTags('Admin')
@ApiCookieAuth(ADMIN_SESSION_COOKIE)
@Controller('admin/logs')
export class AdminRequestLogsController {
  constructor(@Inject(AdminRequestLogsService) private readonly logs: AdminRequestLogsService) {}

  @Get()
  @ApiQuery({
    name: 'githubUsername',
    required: false,
    description: 'GitHub username，不区分大小写',
  })
  @ApiQuery({ name: 'githubId', required: false, description: 'GitHub 数字 ID，精确匹配' })
  list(@Query() query: RequestLogQueryDto) {
    return this.logs.list(query)
  }

  @Get(':requestId')
  detail(@Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string) {
    return this.logs.detail(requestId)
  }
}
