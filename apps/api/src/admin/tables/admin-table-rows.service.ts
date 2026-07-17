import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../database/prisma.service'
import { AdminAuditAction, Prisma } from '../../generated/prisma/client'
import type { AdminFieldKind, AdminTableCapability, AdminTableName } from './admin-table-allowlist'
import { AdminTableAllowlist } from './admin-table-allowlist'
import type { AdminTableRowsQueryDto } from './dto/admin-table-rows-query.dto'

export interface AdminMutationContext {
  actor: string
  requestId?: string
  sourceIp?: string
}

@Injectable()
export class AdminTableRowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allowlist: AdminTableAllowlist,
  ) {}

  async list(tableName: string, query: AdminTableRowsQueryDto) {
    const capability = this.allowlist.assertOperation(tableName, 'query')
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const sortBy = query.sortBy ?? defaultSortField(capability)
    if (!capability.fields.some(({ name }) => name === sortBy)) {
      throw new BadRequestException(`不支持的排序字段：${sortBy}`)
    }
    const orderBy = { [sortBy]: query.sortOrder ?? 'desc' }
    const skip = (page - 1) * pageSize
    const [total, items] = await this.listAllowedTable(
      capability,
      {
        orderBy,
        skip,
        take: pageSize,
      },
      Object.fromEntries(capability.fields.map(({ name }) => [name, true])),
    )
    return { items, page, pageSize, total, pageCount: Math.ceil(total / pageSize) }
  }

  async update(
    tableName: string,
    id: string,
    rawPatch: Record<string, unknown>,
    context: AdminMutationContext,
  ) {
    const capability = this.allowlist.assertEditablePatch(tableName, rawPatch)
    const table = capability.name as Exclude<AdminTableName, 'admin-audit-logs'>
    const patch = normalizePatch(capability, rawPatch)
    return this.prisma.$transaction(async (transaction) => {
      const before = await findRecord(transaction, table, id)
      if (!before) throw new NotFoundException('业务记录不存在')
      const after = await updateRecord(transaction, table, id, patch)
      await writeAudit(transaction, AdminAuditAction.UPDATE, table, id, before, after, context)
      return after
    })
  }

  async delete(tableName: string, id: string, context: AdminMutationContext) {
    const capability = this.allowlist.assertOperation(tableName, 'delete')
    const table = capability.name as Exclude<AdminTableName, 'admin-audit-logs'>
    return this.prisma.$transaction(async (transaction) => {
      const before = await findRecord(transaction, table, id)
      if (!before) throw new NotFoundException('业务记录不存在')
      await deleteRecord(transaction, table, id)
      await writeAudit(transaction, AdminAuditAction.DELETE, table, id, before, null, context)
      return { deleted: true, id }
    })
  }

  private async listAllowedTable(
    capability: AdminTableCapability,
    args: { orderBy: Record<string, 'asc' | 'desc'>; skip: number; take: number },
    select: Record<string, true>,
  ): Promise<[number, unknown[]]> {
    switch (capability.name) {
      case 'request-logs':
        return Promise.all([
          this.prisma.requestLog.count(),
          this.prisma.requestLog.findMany({ ...args, select }),
        ])
      case 'billing-records':
        return Promise.all([
          this.prisma.billingRecord.count(),
          this.prisma.billingRecord.findMany({ ...args, select }),
        ])
      case 'image-generation-tasks':
        return Promise.all([
          this.prisma.imageGenerationTask.count(),
          this.prisma.imageGenerationTask.findMany({ ...args, select }),
        ])
      case 'admin-audit-logs':
        return Promise.all([
          this.prisma.adminAuditLog.count(),
          this.prisma.adminAuditLog.findMany({ ...args, select }),
        ])
    }
  }
}

function defaultSortField(capability: AdminTableCapability): string {
  return capability.fields.some(({ name }) => name === 'createdAt')
    ? 'createdAt'
    : capability.primaryKey
}

function normalizePatch(
  capability: AdminTableCapability,
  rawPatch: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(rawPatch).map(([name, value]) => {
      const field = capability.fields.find((candidate) => candidate.name === name)!
      if (value === null) {
        if (!field.nullable) throw new BadRequestException(`字段 ${name} 不能为空`)
        return [name, field.kind === 'json' ? Prisma.DbNull : null]
      }
      assertFieldValue(name, field.kind, value)
      return [name, value]
    }),
  )
}

function assertFieldValue(name: string, kind: AdminFieldKind, value: unknown): void {
  if (kind === 'string' && (typeof value !== 'string' || value.length > 20_000)) {
    throw new BadRequestException(`字段 ${name} 必须是合法字符串`)
  }
  if (kind === 'number' && (!Number.isInteger(value) || Number(value) < 0)) {
    throw new BadRequestException(`字段 ${name} 必须是非负整数`)
  }
  if (kind === 'boolean' && typeof value !== 'boolean') {
    throw new BadRequestException(`字段 ${name} 必须是布尔值`)
  }
  if (
    kind === 'decimal' &&
    !(
      (typeof value === 'string' && /^\d+(?:\.\d{1,8})?$/.test(value)) ||
      (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    )
  ) {
    throw new BadRequestException(`字段 ${name} 必须是非负金额`)
  }
  if (kind === 'json' && (typeof value !== 'object' || value === null)) {
    throw new BadRequestException(`字段 ${name} 必须是 JSON 对象或数组`)
  }
}

async function findRecord(
  transaction: Prisma.TransactionClient,
  table: AdminTableName,
  id: string,
) {
  switch (table) {
    case 'request-logs':
      return transaction.requestLog.findUnique({ where: { id } })
    case 'billing-records':
      return transaction.billingRecord.findUnique({ where: { id } })
    case 'image-generation-tasks':
      return transaction.imageGenerationTask.findUnique({ where: { id } })
    case 'admin-audit-logs':
      return transaction.adminAuditLog.findUnique({ where: { id } })
  }
}

async function updateRecord(
  transaction: Prisma.TransactionClient,
  table: Exclude<AdminTableName, 'admin-audit-logs'>,
  id: string,
  patch: Record<string, unknown>,
) {
  switch (table) {
    case 'request-logs':
      return transaction.requestLog.update({
        where: { id },
        data: patch as Prisma.RequestLogUpdateInput,
      })
    case 'billing-records':
      return transaction.billingRecord.update({
        where: { id },
        data: patch as Prisma.BillingRecordUpdateInput,
      })
    case 'image-generation-tasks':
      return transaction.imageGenerationTask.update({
        where: { id },
        data: patch as Prisma.ImageGenerationTaskUpdateInput,
      })
  }
}

async function deleteRecord(
  transaction: Prisma.TransactionClient,
  table: Exclude<AdminTableName, 'admin-audit-logs'>,
  id: string,
) {
  switch (table) {
    case 'request-logs': {
      await transaction.billingRecord.deleteMany({ where: { requestLogId: id } })
      return transaction.requestLog.delete({ where: { id } })
    }
    case 'billing-records':
      return transaction.billingRecord.delete({ where: { id } })
    case 'image-generation-tasks':
      return transaction.imageGenerationTask.delete({ where: { id } })
  }
}

async function writeAudit(
  transaction: Prisma.TransactionClient,
  action: AdminAuditAction,
  targetTable: AdminTableName,
  targetId: string,
  before: unknown,
  after: unknown,
  context: AdminMutationContext,
) {
  await transaction.adminAuditLog.create({
    data: {
      actor: context.actor,
      action,
      targetTable,
      targetId,
      beforeData: snapshot(before),
      afterData: after === null ? Prisma.DbNull : snapshot(after),
      ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
      ...(context.sourceIp === undefined ? {} : { sourceIp: context.sourceIp }),
    },
  })
}

function snapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
