import { AdminTableAllowlist } from './admin-table-allowlist'

describe('AdminTableAllowlist', () => {
  const allowlist = new AdminTableAllowlist()

  it('exposes exactly four immutable business table capabilities', () => {
    const tables = allowlist.list()

    expect(tables.map(({ name }) => name)).toEqual([
      'request-logs',
      'billing-records',
      'image-generation-tasks',
      'admin-audit-logs',
    ])
    expect(tables.every(Object.isFrozen)).toBe(true)
    expect(
      tables.every(
        ({ fields, operations }) => Object.isFrozen(fields) && Object.isFrozen(operations),
      ),
    ).toBe(true)
  })

  it('keeps identity, relationship, lifecycle, and timestamp fields immutable', () => {
    for (const table of allowlist.list()) {
      for (const immutable of [
        'id',
        'requestId',
        'requestLogId',
        'taskId',
        'status',
        'createdAt',
        'updatedAt',
      ]) {
        const field = table.fields.find(({ name }) => name === immutable)
        if (field) expect(field.editable).toBe(false)
      }
    }
  })

  it('makes audit logs query-only with no editable fields', () => {
    const audit = allowlist.resolve('admin-audit-logs')

    expect(audit.operations).toEqual(['query'])
    expect(audit.fields.some(({ editable }) => editable)).toBe(false)
    expect(() => allowlist.assertOperation(audit.name, 'delete')).toThrow('不允许 delete')
    expect(() => allowlist.assertEditablePatch(audit.name, { actor: 'attacker' })).toThrow()
  })

  it('rejects unknown tables, SQL-like names, empty patches, and non-allowlisted fields', () => {
    expect(() => allowlist.resolve('users')).toThrow('不支持的业务表')
    expect(() => allowlist.resolve('request-logs; DROP TABLE')).toThrow('不支持的业务表')
    expect(() => allowlist.assertEditablePatch('request-logs', {})).toThrow('不能为空')
    expect(() => allowlist.assertEditablePatch('request-logs', { requestId: 'changed' })).toThrow(
      '不可编辑字段',
    )
    expect(() =>
      allowlist.assertEditablePatch('request-logs', { metadata: { reviewed: true } }),
    ).not.toThrow()
  })
})
