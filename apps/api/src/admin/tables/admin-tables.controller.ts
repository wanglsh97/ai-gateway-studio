import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'

import { ADMIN_SESSION_COOKIE } from '../auth/admin-auth.service'
import type { AdminRequest } from '../auth/admin.guard'
import { AdminTableAllowlist } from './admin-table-allowlist'
import { AdminTableRowsService } from './admin-table-rows.service'
import { AdminTableRowsQueryDto } from './dto/admin-table-rows-query.dto'

type AdminMutationRequest = AdminRequest & { id?: string }

@ApiTags('Admin')
@ApiCookieAuth(ADMIN_SESSION_COOKIE)
@Controller('admin/tables')
export class AdminTablesController {
  constructor(
    private readonly allowlist: AdminTableAllowlist,
    private readonly rows: AdminTableRowsService,
  ) {}

  @Get()
  list() {
    return this.allowlist.list()
  }

  @Get(':table/rows')
  listRows(@Param('table') table: string, @Query() query: AdminTableRowsQueryDto) {
    return this.rows.list(table, query)
  }

  @Patch(':table/rows/:id')
  updateRow(
    @Param('table') table: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() patch: Record<string, unknown>,
    @Req() request: AdminMutationRequest,
  ) {
    return this.rows.update(table, id, patch, mutationContext(request))
  }

  @Delete(':table/rows/:id')
  deleteRow(
    @Param('table') table: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AdminMutationRequest,
  ) {
    return this.rows.delete(table, id, mutationContext(request))
  }
}

function mutationContext(request: AdminMutationRequest) {
  return {
    actor: request.adminSession?.username ?? 'unknown',
    ...(request.id === undefined ? {} : { requestId: request.id }),
    ...(request.ip === undefined ? {} : { sourceIp: request.ip }),
  }
}
