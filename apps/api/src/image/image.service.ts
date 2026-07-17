import type { ImageTask } from '@aigateway/sdk'
import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'

import { PrismaService } from '../database/prisma.service'
import {
  ImageTaskStatus,
  Prisma,
  RequestCapability,
  RequestStatus,
} from '../generated/prisma/client'
import type { ImageAdapter } from './adapters/image-adapter'
import { ImageAdapterRegistry } from './adapters/image-adapter.registry'
import type { CreateImageGenerationDto } from './dto/create-image-generation.dto'
import { isImageAdapterId, isImageModelAlias } from './image.constants'
import { assertImageTaskTransition, isTerminalImageTaskStatus } from './image-task-state'

@Injectable()
export class ImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adapters: ImageAdapterRegistry,
  ) {}

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

  async get(taskId: string, signal: AbortSignal): Promise<ImageTask> {
    let task = await this.findTask(taskId)
    const currentStatus = toPublicStatus(task.status)
    if (isTerminalImageTaskStatus(currentStatus)) return this.toPublicTask(task)
    if (!task.provider || !task.providerTaskId) return this.toPublicTask(task)
    if (!isImageAdapterId(task.provider) || !this.adapters.has(task.provider)) {
      throw new ServiceUnavailableException('图片任务对应的 Provider 当前不可用')
    }

    const status = await this.adapters.get(task.provider).getStatus({
      providerTaskId: task.providerTaskId,
      signal,
    })
    assertImageTaskTransition(currentStatus, status.status)
    const nextStatus = toDatabaseStatus(status.status)
    const completedAt = isTerminalImageTaskStatus(status.status) ? new Date() : undefined

    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.imageGenerationTask.updateMany({
        where: { id: task.id, status: task.status },
        data: {
          status: nextStatus,
          ...(status.results === undefined
            ? {}
            : {
                results: status.results.map((result) => ({
                  ...result,
                })) as Prisma.InputJsonValue,
              }),
          errorCode: status.errorCode ?? null,
          errorMessage: status.errorMessage ?? null,
          lastPolledAt: new Date(),
          ...(completedAt === undefined ? {} : { completedAt }),
        },
      })
      if (updated.count !== 1 || completedAt === undefined) return

      await transaction.requestLog.updateMany({
        where: { id: task.requestLogId, status: RequestStatus.PENDING },
        data: {
          status: status.status === 'succeeded' ? RequestStatus.SUCCEEDED : RequestStatus.FAILED,
          completedAt,
          durationMs: Math.max(0, completedAt.getTime() - task.createdAt.getTime()),
          errorCode: status.errorCode ?? null,
          errorMessage: status.errorMessage ?? null,
        },
      })
      await transaction.billingRecord.upsert({
        where: { requestLogId: task.requestLogId },
        create: { requestLogId: task.requestLogId, usageUnknown: true },
        update: { usageUnknown: true },
      })
    })

    task = await this.findTask(taskId)
    return this.toPublicTask(task)
  }

  private async findTask(taskId: string) {
    const task = await this.prisma.imageGenerationTask.findUnique({
      where: { taskId },
      include: { requestLog: { select: { requestId: true } } },
    })
    if (!task) throw new NotFoundException('图片任务不存在')
    return task
  }

  toPublicTask(task: {
    requestLog?: { requestId: string }
    taskId: string
    modelAlias: string
    status: ImageTaskStatus
    results?: unknown
    errorCode?: string | null
    errorMessage?: string | null
    createdAt: Date
    updatedAt: Date
  }): ImageTask {
    if (!isImageModelAlias(task.modelAlias)) {
      throw new ServiceUnavailableException('图片任务包含未知模型 alias')
    }
    const results = parsePublicResults(task.results)
    return {
      taskId: task.taskId,
      model: task.modelAlias,
      status: toPublicStatus(task.status),
      results,
      ...(task.errorCode
        ? {
            error: {
              requestId: task.requestLog?.requestId ?? 'unknown',
              code: task.errorCode,
              message: task.errorMessage ?? '图片生成失败',
              retryable: false,
            },
          }
        : {}),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }
  }
}

function toPublicStatus(status: ImageTaskStatus): ImageTask['status'] {
  return status.toLowerCase() as ImageTask['status']
}

function toDatabaseStatus(status: ImageTask['status']): ImageTaskStatus {
  return ImageTaskStatus[status.toUpperCase() as keyof typeof ImageTaskStatus]
}

function parsePublicResults(value: unknown): ImageTask['results'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (typeof item !== 'object' || item === null) return []
    const result = item as Record<string, unknown>
    return [
      {
        index,
        ...(typeof result.width === 'number' ? { width: result.width } : {}),
        ...(typeof result.height === 'number' ? { height: result.height } : {}),
        ...(typeof result.contentType === 'string' ? { contentType: result.contentType } : {}),
      },
    ]
  })
}
