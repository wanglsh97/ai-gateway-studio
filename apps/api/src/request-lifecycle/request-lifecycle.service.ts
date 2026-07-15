import type { Capability, ModelAlias } from '@aigateway/sdk'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'

import { Prisma, RequestCapability, RequestStatus } from '../generated/prisma/client'
import type { RequestLog } from '../generated/prisma/client'
import { PrismaService } from '../database/prisma.service'

const REQUEST_CAPABILITY_MAP = {
  chat: RequestCapability.CHAT,
  image: RequestCapability.IMAGE,
  prompt: RequestCapability.PROMPT,
} as const satisfies Record<Capability, RequestCapability>

export interface StartRequestLifecycleInput {
  requestId: string
  capability: Capability
  prompt: Prisma.InputJsonValue
  modelAlias: ModelAlias
  stream: boolean
  provider?: string
  resolvedModel?: string
  clientIp?: string
  metadata?: Prisma.InputJsonValue
}

export type StartedRequestLifecycle = Pick<RequestLog, 'id' | 'requestId' | 'status' | 'startedAt'>

export class RequestLifecycleStartError extends ServiceUnavailableException {
  constructor(cause: unknown) {
    super('请求记录创建失败，暂不能调用模型', { cause })
  }
}

@Injectable()
export class RequestLifecycleService {
  private readonly logger = new Logger(RequestLifecycleService.name)

  constructor(private readonly prisma: PrismaService) {}

  async start(input: StartRequestLifecycleInput): Promise<StartedRequestLifecycle> {
    try {
      return await this.prisma.requestLog.create({
        data: {
          requestId: input.requestId,
          capability: REQUEST_CAPABILITY_MAP[input.capability],
          prompt: input.prompt,
          modelAlias: input.modelAlias,
          stream: input.stream,
          status: RequestStatus.PENDING,
          ...(input.provider === undefined ? {} : { provider: input.provider }),
          ...(input.resolvedModel === undefined ? {} : { resolvedModel: input.resolvedModel }),
          ...(input.clientIp === undefined ? {} : { clientIp: input.clientIp }),
          ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
        },
        select: {
          id: true,
          requestId: true,
          status: true,
          startedAt: true,
        },
      })
    } catch (error) {
      this.logger.error(
        { error, requestId: input.requestId, capability: input.capability },
        'Failed to create pending request log',
      )
      throw new RequestLifecycleStartError(error)
    }
  }
}
