import { Controller, Get } from '@nestjs/common'

import { AdminTableAllowlist } from './admin-table-allowlist'

@Controller('admin/tables')
export class AdminTablesController {
  constructor(private readonly allowlist: AdminTableAllowlist) {}

  @Get()
  list() {
    return this.allowlist.list()
  }
}
