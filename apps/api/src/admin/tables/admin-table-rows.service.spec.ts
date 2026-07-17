import type { PrismaService } from '../../database/prisma.service'
import { AdminTableAllowlist } from './admin-table-allowlist'
import { AdminTableRowsService } from './admin-table-rows.service'

function delegate() {
  return {
    count: jest.fn().mockResolvedValue(1),
    findMany: jest.fn().mockResolvedValue([{ id: 'row-1' }]),
    findUnique: jest.fn().mockResolvedValue({ id: 'row-1', inputTokens: 1 }),
    update: jest.fn().mockResolvedValue({ id: 'row-1', inputTokens: 2 }),
    delete: jest.fn().mockResolvedValue({ id: 'row-1' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  }
}

function setup() {
  const requestLog = delegate()
  const billingRecord = delegate()
  const imageGenerationTask = delegate()
  const adminAuditLog = delegate()
  const transactionClient = { requestLog, billingRecord, imageGenerationTask, adminAuditLog }
  const transaction = jest.fn(async (operation: (client: typeof transactionClient) => unknown) =>
    operation(transactionClient),
  )
  const prisma = {
    ...transactionClient,
    $transaction: transaction,
  } as unknown as PrismaService
  return {
    adminAuditLog,
    billingRecord,
    imageGenerationTask,
    requestLog,
    service: new AdminTableRowsService(prisma, new AdminTableAllowlist()),
    transaction,
  }
}

describe('AdminTableRowsService', () => {
  it.each([
    ['request-logs', 'requestLog'],
    ['billing-records', 'billingRecord'],
    ['image-generation-tasks', 'imageGenerationTask'],
    ['admin-audit-logs', 'adminAuditLog'],
  ] as const)('queries only the mapped delegate for %s', async (table, delegateName) => {
    const context = setup()

    await expect(context.service.list(table, { page: 2, pageSize: 10 })).resolves.toEqual({
      items: [{ id: 'row-1' }],
      page: 2,
      pageSize: 10,
      total: 1,
      pageCount: 1,
    })
    expect(context[delegateName].findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: expect.any(Object),
      skip: 10,
      take: 10,
    })
  })

  it('never projects complete Prompt fields from generic database row lists', async () => {
    const context = setup()

    await context.service.list('request-logs', {})
    await context.service.list('image-generation-tasks', {})

    const requestSelect = context.requestLog.findMany.mock.calls[0]?.[0]?.select
    const imageSelect = context.imageGenerationTask.findMany.mock.calls[0]?.[0]?.select
    expect(requestSelect).not.toHaveProperty('prompt')
    expect(imageSelect).not.toHaveProperty('prompt')
  })

  it('rejects unknown sort fields and unknown tables before querying Prisma', async () => {
    const { requestLog, service } = setup()

    await expect(service.list('request-logs', { sortBy: 'DROP TABLE' })).rejects.toMatchObject({
      status: 400,
    })
    await expect(service.list('users', {})).rejects.toMatchObject({ status: 404 })
    expect(requestLog.findMany).not.toHaveBeenCalled()
  })

  it('validates fields then updates and writes its audit in the same transaction', async () => {
    const { adminAuditLog, billingRecord, service, transaction } = setup()

    await expect(
      service.update(
        'billing-records',
        '00000000-0000-4000-8000-000000000212',
        { inputTokens: 2, estimatedCostCny: '0.12000000' },
        {
          actor: 'root',
          requestId: '00000000-0000-4000-8000-000000000999',
          sourceIp: '127.0.0.1',
        },
      ),
    ).resolves.toMatchObject({ inputTokens: 2 })
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(billingRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { inputTokens: 2, estimatedCostCny: '0.12000000' },
      }),
    )
    expect(adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actor: 'root',
          action: 'UPDATE',
          targetTable: 'billing-records',
          beforeData: expect.any(Object),
          afterData: expect.any(Object),
        }),
      }),
    )
  })

  it('rejects immutable fields, malformed values, audit mutation, and missing records', async () => {
    const { billingRecord, service, transaction } = setup()

    await expect(
      service.update(
        'billing-records',
        '00000000-0000-4000-8000-000000000212',
        { id: 'x' },
        { actor: 'root' },
      ),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      service.update(
        'billing-records',
        '00000000-0000-4000-8000-000000000212',
        { inputTokens: -1 },
        { actor: 'root' },
      ),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      service.update(
        'admin-audit-logs',
        '00000000-0000-4000-8000-000000000212',
        { actor: 'intruder' },
        { actor: 'root' },
      ),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      service.delete('admin-audit-logs', '00000000-0000-4000-8000-000000000212', { actor: 'root' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(transaction).not.toHaveBeenCalled()

    billingRecord.findUnique.mockResolvedValueOnce(null)
    await expect(
      service.delete('billing-records', '00000000-0000-4000-8000-000000000212', { actor: 'root' }),
    ).rejects.toMatchObject({ status: 404 })
    expect(billingRecord.delete).not.toHaveBeenCalled()
  })

  it('deletes an allowed row and records a delete snapshot atomically', async () => {
    const { adminAuditLog, imageGenerationTask, service, transaction } = setup()

    await expect(
      service.delete('image-generation-tasks', '00000000-0000-4000-8000-000000000212', {
        actor: 'root',
      }),
    ).resolves.toEqual({ deleted: true, id: '00000000-0000-4000-8000-000000000212' })
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(imageGenerationTask.delete).toHaveBeenCalled()
    expect(adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DELETE', afterData: expect.anything() }),
      }),
    )
  })

  it('rejects the update transaction when its audit snapshot cannot be persisted', async () => {
    const context = setup()
    const auditFailure = new Error('audit persistence failed')
    context.adminAuditLog.create.mockRejectedValueOnce(auditFailure)

    await expect(
      context.service.update(
        'billing-records',
        '00000000-0000-4000-8000-000000000212',
        { inputTokens: 3 },
        { actor: 'root' },
      ),
    ).rejects.toBe(auditFailure)

    expect(context.transaction).toHaveBeenCalledTimes(1)
    expect(context.billingRecord.update).toHaveBeenCalledTimes(1)
    expect(context.adminAuditLog.create).toHaveBeenCalledTimes(1)
  })

  it('rejects the delete transaction when its audit snapshot cannot be persisted', async () => {
    const context = setup()
    const auditFailure = new Error('audit persistence failed')
    context.adminAuditLog.create.mockRejectedValueOnce(auditFailure)

    await expect(
      context.service.delete('image-generation-tasks', '00000000-0000-4000-8000-000000000212', {
        actor: 'root',
      }),
    ).rejects.toBe(auditFailure)

    expect(context.transaction).toHaveBeenCalledTimes(1)
    expect(context.imageGenerationTask.delete).toHaveBeenCalledTimes(1)
    expect(context.adminAuditLog.create).toHaveBeenCalledTimes(1)
  })

  it('deletes a request billing relation in the same transaction and rejects a repeated delete', async () => {
    const context = setup()
    const id = '00000000-0000-4000-8000-000000000212'

    await expect(context.service.delete('request-logs', id, { actor: 'root' })).resolves.toEqual({
      deleted: true,
      id,
    })

    expect(context.transaction).toHaveBeenCalledTimes(1)
    expect(context.billingRecord.deleteMany).toHaveBeenCalledWith({
      where: { requestLogId: id },
    })
    expect(context.requestLog.delete).toHaveBeenCalledWith({ where: { id } })
    expect(context.adminAuditLog.create).toHaveBeenCalledTimes(1)

    context.requestLog.findUnique.mockResolvedValueOnce(null)
    await expect(
      context.service.delete('request-logs', id, { actor: 'root' }),
    ).rejects.toMatchObject({ status: 404 })

    expect(context.transaction).toHaveBeenCalledTimes(2)
    expect(context.billingRecord.deleteMany).toHaveBeenCalledTimes(1)
    expect(context.requestLog.delete).toHaveBeenCalledTimes(1)
    expect(context.adminAuditLog.create).toHaveBeenCalledTimes(1)
  })
})
