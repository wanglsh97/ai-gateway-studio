import { randomUUID } from 'node:crypto'

import type { ImageTask } from '@aigateway/sdk'
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { Request } from 'express'

import { RateLimitService } from '../rate-limit/rate-limit.service'
import type { ImageAdapter } from './adapters/image-adapter'
import { ImageAdapterRegistry } from './adapters/image-adapter.registry'
import { CreateImageGenerationDto } from './dto/create-image-generation.dto'
import { ImageService } from './image.service'

type RequestWithId = Request & { id?: string }

@Controller('images/generations')
export class ImageController {
  constructor(
    private readonly adapters: ImageAdapterRegistry,
    private readonly images: ImageService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post()
  async create(
    @Body() input: CreateImageGenerationDto,
    @Req() request: RequestWithId,
  ): Promise<ImageTask> {
    await this.rateLimit.consumeImage(request.ip)
    const requestId = request.id ?? randomUUID()
    const adapter = this.resolveAdapter(input.model)
    const task = await this.images.createPending(requestId, input, adapter, request.ip)
    const abortController = new AbortController()
    const abort = () => abortController.abort()
    request.once('aborted', abort)
    const submission = await adapter
      .submit({
        requestId,
        modelAlias: input.model,
        resolvedModel: adapter.resolvedModel,
        prompt: input.prompt,
        signal: abortController.signal,
        ...(input.size === undefined ? {} : { size: input.size }),
        ...(input.count === undefined ? {} : { count: input.count }),
      })
      .finally(() => request.removeListener('aborted', abort))
    const updated = await this.images.recordSubmission(
      task.taskId,
      submission.providerTaskId,
      submission.status,
    )
    return this.images.toPublicTask(updated)
  }

  @Get(':taskId')
  async get(@Param('taskId') taskId: string, @Req() request: RequestWithId): Promise<ImageTask> {
    const abortController = new AbortController()
    const abort = () => abortController.abort()
    request.once('aborted', abort)
    return this.images
      .get(taskId, abortController.signal)
      .finally(() => request.removeListener('aborted', abort))
  }

  private resolveAdapter(alias: CreateImageGenerationDto['model']): ImageAdapter {
    if (this.adapters.has(alias)) return this.adapters.get(alias)
    if (this.adapters.has('mock')) return this.adapters.get('mock')
    throw new ServiceUnavailableException('当前没有可用的图片模型')
  }
}
