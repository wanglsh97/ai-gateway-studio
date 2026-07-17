import { randomUUID } from 'node:crypto'

import type { ImageTask } from '@aigateway/sdk'
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { Request, Response } from 'express'

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

  @Get(':taskId/images/:index/download')
  async download(
    @Param('taskId') taskId: string,
    @Param('index', ParseIntPipe) index: number,
    @Req() request: RequestWithId,
    @Res() response: Response,
  ): Promise<void> {
    const abortController = new AbortController()
    const abort = () => abortController.abort()
    request.once('aborted', abort)
    const image = await this.images
      .download(taskId, index, abortController.signal)
      .finally(() => request.removeListener('aborted', abort))
    const extension = image.contentType === 'image/jpeg' ? 'jpg' : image.contentType.split('/')[1]
    response.set({
      'content-type': image.contentType,
      'content-length': String(image.body.byteLength),
      'content-disposition': `attachment; filename="aigateway-${taskId}-${index}.${extension}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=300',
    })
    response.send(Buffer.from(image.body))
  }

  private resolveAdapter(alias: CreateImageGenerationDto['model']): ImageAdapter {
    if (this.adapters.has(alias)) return this.adapters.get(alias)
    if (this.adapters.has('mock')) return this.adapters.get('mock')
    throw new ServiceUnavailableException('当前没有可用的图片模型')
  }
}
