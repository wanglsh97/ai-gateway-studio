import { Module } from '@nestjs/common'

import { AdminTableAllowlist } from './admin-table-allowlist'
import { AdminTablesController } from './admin-tables.controller'

@Module({
  controllers: [AdminTablesController],
  providers: [AdminTableAllowlist],
  exports: [AdminTableAllowlist],
})
export class AdminTablesModule {}
