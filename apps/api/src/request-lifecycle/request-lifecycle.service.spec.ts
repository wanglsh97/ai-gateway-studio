import { Logger } from '@nestjs/common'

import type { PrismaService } from '../database/prisma.service'
import { RequestStatus } from '../generated/prisma/client'
import {
  RequestLifecycleService,
  RequestLifecycleStartError,
  type StartRequestLifecycleInput,
} from './request-lifecycle.service'

const requestId = '00000000-0000-4000-8000-000000000002'
const startedAt = new Date('2026-07-15T00:00:00.000Z')
const messages = [
  { role: 'system', content: '保留完整系统提示词' },
  { role: 'user', content: '保留完整用户问题' },
  { role: 'assistant', content: '保留完整历史回答' },
]

const input: StartRequestLifecycleInput = {
  requestId,
  capability: 'chat',
  prompt: { messages },
  modelAlias: 'qwen',
  provider: 'mock',
  resolvedModel: 'mock-chat-v1',
  stream: true,
  clientIp: '127.0.0.1',
  metadata: { source: 'unit-test' },
}

function createService() {
  const create = jest.fn()
  const prisma = { requestLog: { create } } as unknown as PrismaService
  return { create, service: new RequestLifecycleService(prisma) }
}

describe('RequestLifecycleService.start', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('persists the complete messages before returning a pending lifecycle', async () => {
    const { create, service } = createService()
    create.mockResolvedValue({ id: 'log-1', requestId, status: RequestStatus.PENDING, startedAt })

    await expect(service.start(input)).resolves.toEqual({
      id: 'log-1',
      requestId,
      status: RequestStatus.PENDING,
      startedAt,
    })
    expect(create).toHaveBeenCalledWith({
      data: {
        requestId,
        capability: 'CHAT',
        prompt: { messages },
        modelAlias: 'qwen',
        provider: 'mock',
        resolvedModel: 'mock-chat-v1',
        stream: true,
        status: 'PENDING',
        clientIp: '127.0.0.1',
        metadata: { source: 'unit-test' },
      },
      select: { id: true, requestId: true, status: true, startedAt: true },
    })
  })

  it('prevents provider invocation when the pending record cannot be created', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const { create, service } = createService()
    const invokeProvider = jest.fn()
    create.mockRejectedValue(new Error('database unavailable'))

    const startThenInvokeProvider = async () => {
      await service.start(input)
      invokeProvider()
    }

    await expect(startThenInvokeProvider()).rejects.toBeInstanceOf(RequestLifecycleStartError)
    expect(invokeProvider).not.toHaveBeenCalled()
  })
})
