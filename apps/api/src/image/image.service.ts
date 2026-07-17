import type { ImageTask } from '@aigateway/sdk'
import { Injectable, ServiceUnavailableException } from '@nestjs/common'

import { PrismaService } from '../database/prisma.service'
import { ImageTaskStatus, RequestCapability, RequestStatus } from '../generated/prisma/client'
import type { ImageAdapter } from './adapters/image-adapter'
import type { CreateImageGenerationDto } from './dto/create-image-generation.dto'

@Injectable()
export class ImageService {
  constructor(private readonly prisma: PrismaService) {}

  async createPending(
    requestId: string,
    input: CreateImageGenerationDto,
    adapter: ImageAdapter,
    clientIp: string | undefined,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const log = await transaction.requestLog.create({
          data: {
            requestId,
            capability: RequestCapability.IMAGE,
            prompt: { prompt: input.prompt },
            modelAlias: input.model,
            provider: adapter.id,
            resolvedModel: adapter.resolvedModel,
            status: RequestStatus.PENDING,
            stream: false,
            ...(clientIp === undefined ? {} : { clientIp }),
          },
        })
        return transaction.imageGenerationTask.create({
          data: {
            requestLogId: log.id,
            prompt: input.prompt,
            modelAlias: input.model,
            provider: adapter.id,
            resolvedModel: adapter.resolvedModel,
            status: ImageTaskStatus.PENDING,
            options: {
              ...(input.size === undefined ? {} : { size: input.size }),
              ...(input.count === undefined ? {} : { count: input.count }),
            },
          },
        })
      })
    } catch (error) {
      throw new ServiceUnavailableException('图片任务记录创建失败，暂不能调用模型', {
        cause: error,
      })
    }
  }

  async recordSubmission(taskId: string, providerTaskId: string, status: 'pending' | 'running') {
    return this.prisma.imageGenerationTask.update({
      where: { taskId },
      data: {
        providerTaskId,
        status: status === 'running' ? ImageTaskStatus.RUNNING : ImageTaskStatus.PENDING,
        startedAt: new Date(),
      },
    })
  }

  toPublicTask(task: {
    taskId: string
    modelAlias: string
    status: ImageTaskStatus
    createdAt: Date
    updatedAt: Date
  }): ImageTask {
    return {
      taskId: task.taskId,
      model: task.modelAlias as ImageTask['model'],
      status: task.status.toLowerCase() as ImageTask['status'],
      results: [],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }
  }
}
