import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

export const ADMIN_TABLE_NAMES = [
  'request-logs',
  'billing-records',
  'image-generation-tasks',
  'admin-audit-logs',
] as const

export type AdminTableName = (typeof ADMIN_TABLE_NAMES)[number]
export type AdminTableOperation = 'query' | 'update' | 'delete'
export type AdminFieldKind =
  'string' | 'number' | 'boolean' | 'decimal' | 'datetime' | 'json' | 'enum'

export interface AdminTableFieldCapability {
  name: string
  label: string
  kind: AdminFieldKind
  nullable: boolean
  editable: boolean
}

export interface AdminTableCapability {
  name: AdminTableName
  label: string
  primaryKey: string
  operations: readonly AdminTableOperation[]
  fields: readonly AdminTableFieldCapability[]
}

const field = (
  name: string,
  label: string,
  kind: AdminFieldKind,
  nullable = false,
  editable = false,
): AdminTableFieldCapability => Object.freeze({ name, label, kind, nullable, editable })

const capabilities: readonly AdminTableCapability[] = Object.freeze([
  Object.freeze({
    name: 'request-logs',
    label: '调用日志',
    primaryKey: 'id',
    operations: Object.freeze(['query', 'update', 'delete'] as const),
    fields: Object.freeze([
      field('id', 'ID', 'string'),
      field('requestId', 'Request ID', 'string'),
      field('capability', '能力', 'enum'),
      field('modelAlias', '模型 Alias', 'string'),
      field('provider', 'Provider', 'string', true, true),
      field('resolvedModel', '实际模型', 'string', true, true),
      field('status', '状态', 'enum'),
      field('metadata', 'Metadata', 'json', true, true),
      field('errorCode', '错误码', 'string', true, true),
      field('errorMessage', '错误信息', 'string', true, true),
      field('errorDetails', '错误详情', 'json', true, true),
      field('createdAt', '创建时间', 'datetime'),
      field('updatedAt', '更新时间', 'datetime'),
    ]),
  }),
  Object.freeze({
    name: 'billing-records',
    label: '计费明细',
    primaryKey: 'id',
    operations: Object.freeze(['query', 'update', 'delete'] as const),
    fields: Object.freeze([
      field('id', 'ID', 'string'),
      field('requestLogId', 'RequestLog ID', 'string'),
      field('inputTokens', '输入 Token', 'number', true, true),
      field('outputTokens', '输出 Token', 'number', true, true),
      field('totalTokens', '总 Token', 'number', true, true),
      field('usageUnknown', 'Usage 未知', 'boolean', false, true),
      field('priceVersion', '价格版本', 'string', true, true),
      field('inputCostCny', '输入费用', 'decimal', true, true),
      field('outputCostCny', '输出费用', 'decimal', true, true),
      field('estimatedCostCny', '预估费用', 'decimal', true, true),
      field('createdAt', '创建时间', 'datetime'),
      field('updatedAt', '更新时间', 'datetime'),
    ]),
  }),
  Object.freeze({
    name: 'image-generation-tasks',
    label: '文生图任务',
    primaryKey: 'id',
    operations: Object.freeze(['query', 'update', 'delete'] as const),
    fields: Object.freeze([
      field('id', 'ID', 'string'),
      field('taskId', 'Task ID', 'string'),
      field('requestLogId', 'RequestLog ID', 'string'),
      field('providerTaskId', 'Provider Task ID', 'string', true, true),
      field('modelAlias', '模型 Alias', 'string'),
      field('provider', 'Provider', 'string', true, true),
      field('resolvedModel', '实际模型', 'string', true, true),
      field('options', '生成参数', 'json', true, true),
      field('status', '状态', 'enum'),
      field('results', '结果', 'json', true, true),
      field('errorCode', '错误码', 'string', true, true),
      field('errorMessage', '错误信息', 'string', true, true),
      field('createdAt', '创建时间', 'datetime'),
      field('updatedAt', '更新时间', 'datetime'),
    ]),
  }),
  Object.freeze({
    name: 'admin-audit-logs',
    label: '管理员操作审计',
    primaryKey: 'id',
    operations: Object.freeze(['query'] as const),
    fields: Object.freeze([
      field('id', 'ID', 'string'),
      field('actor', '操作者', 'string'),
      field('action', '操作', 'enum'),
      field('targetTable', '目标表', 'string'),
      field('targetId', '目标记录', 'string'),
      field('beforeData', '变更前', 'json', true),
      field('afterData', '变更后', 'json', true),
      field('requestId', 'Request ID', 'string', true),
      field('sourceIp', '来源 IP', 'string', true),
      field('createdAt', '创建时间', 'datetime'),
    ]),
  }),
])

@Injectable()
export class AdminTableAllowlist {
  list(): readonly AdminTableCapability[] {
    return capabilities
  }

  resolve(name: string): AdminTableCapability {
    const capability = capabilities.find((candidate) => candidate.name === name)
    if (!capability) throw new NotFoundException('不支持的业务表')
    return capability
  }

  assertOperation(name: string, operation: AdminTableOperation): AdminTableCapability {
    const capability = this.resolve(name)
    if (!capability.operations.includes(operation)) {
      throw new BadRequestException(`表 ${name} 不允许 ${operation} 操作`)
    }
    return capability
  }

  assertEditablePatch(name: string, patch: Record<string, unknown>): AdminTableCapability {
    const capability = this.assertOperation(name, 'update')
    const editable = new Set(
      capability.fields.filter(({ editable }) => editable).map(({ name }) => name),
    )
    const fields = Object.keys(patch)
    if (fields.length === 0) throw new BadRequestException('更新字段不能为空')
    const rejected = fields.filter((candidate) => !editable.has(candidate))
    if (rejected.length > 0) {
      throw new BadRequestException(`包含不可编辑字段：${rejected.join(', ')}`)
    }
    return capability
  }
}
