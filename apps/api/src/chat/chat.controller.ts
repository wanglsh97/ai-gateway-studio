import { randomUUID } from 'node:crypto'

import type {
  ChatFinishReason,
  ChatSseDeltaPayload,
  ChatSseErrorPayload,
  ChatSseUsagePayload,
  TextModelAlias,
} from '@aigateway/sdk'
import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import {
  RequestLifecycleFinishError,
  RequestLifecycleService,
  RequestLifecycleTransitionError,
} from '../request-lifecycle/request-lifecycle.service'
import { RateLimitService } from '../rate-limit/rate-limit.service'
import { ChatAdapterError } from './adapters/chat-adapter'
import type { ChatAdapter, ChatAdapterUsage } from './adapters/chat-adapter'
import { ChatAdapterRegistry } from './adapters/chat-adapter.registry'
import { ChatFailoverService } from './chat-failover.service'
import { writeChatSseDone, writeChatSsePayload } from './chat-sse.writer'
import { ChatCompletionRequestDto } from './dto/chat-completion-request.dto'
import { ProviderHealthService } from './provider-health.service'

type RequestWithId = Request & { id?: string }

interface ChatStreamState {
  firstTokenAt?: Date
  providerRequestId?: string
  usage?: ChatAdapterUsage
}

interface ChatStreamCompletion {
  finishReason: ChatFinishReason
  usage: ChatAdapterUsage
}

interface ChatExecutionResult {
  completion: ChatStreamCompletion
  adapter: ChatAdapter
  failover?: { from: string; to: string; reason: string }
}

@Controller('chat')
export class ChatController {
  constructor(
    @Inject(ChatAdapterRegistry) private readonly adapters: ChatAdapterRegistry,
    @Inject(RequestLifecycleService) private readonly lifecycle: RequestLifecycleService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(ProviderHealthService) private readonly providerHealth: ProviderHealthService,
    @Inject(ChatFailoverService) private readonly failover: ChatFailoverService,
  ) {}

  @Post('completions')
  async create(
    @Body() input: ChatCompletionRequestDto,
    @Req() request: RequestWithId,
    @Res() response: Response,
  ): Promise<void> {
    const requestId = request.id ?? randomUUID()
    await this.rateLimit.consumeChat(request.ip)
    const adapter = this.resolveAdapter(input.model)

    const started = await this.lifecycle.start({
      requestId,
      capability: 'chat',
      prompt: {
        messages: input.messages.map(({ role, content }) => ({ role, content })),
      },
      modelAlias: input.model,
      provider: adapter.id,
      resolvedModel: adapter.resolvedModel,
      stream: true,
      ...(input.comparison === undefined ? {} : { metadata: { comparison: input.comparison } }),
      ...(request.ip === undefined ? {} : { clientIp: request.ip }),
    })

    const abortController = new AbortController()
    const abort = () => abortController.abort()
    const abortOnResponseClose = () => {
      if (!response.writableEnded) abort()
    }
    request.once('aborted', abort)
    response.once('close', abortOnResponseClose)

    this.openStream(response, requestId)

    const state: ChatStreamState = {}
    let finalizationAttempted = false

    try {
      const execution = await this.executeWithFailover(
        input,
        adapter,
        requestId,
        abortController.signal,
        response,
        state,
      )
      if (abortController.signal.aborted) throw this.abortError()

      finalizationAttempted = true
      await this.lifecycle.finish({
        requestLogId: started.id,
        requestId,
        startedAt: started.startedAt,
        status: 'succeeded',
        ...(state.firstTokenAt === undefined ? {} : { firstTokenAt: state.firstTokenAt }),
        ...(state.providerRequestId === undefined
          ? {}
          : { providerRequestId: state.providerRequestId }),
        provider: execution.adapter.id,
        resolvedModel: execution.adapter.resolvedModel,
        ...(execution.failover === undefined ? {} : { failover: execution.failover }),
        usage: execution.completion.usage,
      })
      this.writeCompletion(input, requestId, execution.completion, response)
    } catch (error) {
      let responseError = error

      if (!finalizationAttempted) {
        finalizationAttempted = true
        try {
          await this.lifecycle.finish({
            requestLogId: started.id,
            requestId,
            startedAt: started.startedAt,
            status: abortController.signal.aborted ? 'cancelled' : 'failed',
            ...(state.firstTokenAt === undefined ? {} : { firstTokenAt: state.firstTokenAt }),
            ...(state.providerRequestId === undefined
              ? {}
              : { providerRequestId: state.providerRequestId }),
            ...(state.usage === undefined ? {} : { usage: state.usage }),
            ...(abortController.signal.aborted ? {} : { error: this.toLifecycleError(error) }),
          })
        } catch (finishError) {
          responseError = finishError
        }
      }

      if (!abortController.signal.aborted && this.canWrite(response)) {
        writeChatSsePayload(response, this.toErrorPayload(responseError, requestId))
      }
    } finally {
      request.removeListener('aborted', abort)
      response.removeListener('close', abortOnResponseClose)
      if (this.canWrite(response)) response.end()
    }
  }

  private resolveAdapter(modelAlias: TextModelAlias): ChatAdapter {
    if (this.adapters.has(modelAlias)) return this.adapters.get(modelAlias)
    if (this.adapters.has('mock')) return this.adapters.get('mock')
    throw new ServiceUnavailableException('当前没有可用的 Chat 模型')
  }

  private openStream(response: Response, requestId: string): void {
    response.status(200)
    response.set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'x-request-id': requestId,
    })
    response.flushHeaders()
  }

  private async pipeAdapterStream(
    input: ChatCompletionRequestDto,
    adapter: ChatAdapter,
    requestId: string,
    signal: AbortSignal,
    response: Response,
    state: ChatStreamState,
  ): Promise<ChatStreamCompletion> {
    const id = `chatcmpl-${requestId}`
    const created = Math.floor(Date.now() / 1_000)
    let firstDelta = true
    let finishReason: ChatFinishReason | undefined

    for await (const event of adapter.stream({
      requestId,
      modelAlias: input.model,
      resolvedModel: adapter.resolvedModel,
      messages: input.messages,
      signal,
      ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
      ...(input.topP === undefined ? {} : { topP: input.topP }),
      ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }),
    })) {
      if (event.providerRequestId !== undefined) state.providerRequestId = event.providerRequestId

      if (event.type === 'delta') {
        state.firstTokenAt ??= new Date()
        const payload: ChatSseDeltaPayload = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: input.model,
          request_id: requestId,
          choices: [
            {
              index: 0,
              delta: {
                ...(firstDelta ? { role: 'assistant' as const } : {}),
                content: event.content,
              },
              finish_reason: null,
            },
          ],
        }
        writeChatSsePayload(response, payload)
        firstDelta = false
        continue
      }

      if (event.type === 'usage') {
        if (state.usage) throw this.protocolError('Adapter emitted usage more than once')
        state.usage = event.usage
        continue
      }

      if (finishReason) throw this.protocolError('Adapter emitted finish more than once')
      finishReason = event.finishReason
    }

    if (!finishReason) throw this.protocolError('Adapter stream ended without finish')
    if (!state.usage) throw this.protocolError('Adapter stream ended without usage')

    return { finishReason, usage: state.usage }
  }

  private async pipeAdapterStreamWithHealth(
    input: ChatCompletionRequestDto,
    adapter: ChatAdapter,
    requestId: string,
    signal: AbortSignal,
    response: Response,
    state: ChatStreamState,
  ): Promise<ChatStreamCompletion> {
    const startedAt = Date.now()

    try {
      const completion = await this.pipeAdapterStream(
        input,
        adapter,
        requestId,
        signal,
        response,
        state,
      )
      await this.providerHealth.recordSuccess(adapter.id, Date.now() - startedAt)
      return completion
    } catch (error) {
      if (!signal.aborted && error instanceof ChatAdapterError) {
        await this.providerHealth.recordFailure(adapter.id, Date.now() - startedAt, {
          code: error.code,
          affectsHealth:
            error.retryable &&
            (error.statusCode === undefined ||
              error.statusCode >= 500 ||
              error.code.includes('TIMEOUT')),
        })
      }
      throw error
    }
  }

  private async executeWithFailover(
    input: ChatCompletionRequestDto,
    primary: ChatAdapter,
    requestId: string,
    signal: AbortSignal,
    response: Response,
    state: ChatStreamState,
  ): Promise<ChatExecutionResult> {
    try {
      const completion = await this.pipeAdapterStreamWithHealth(
        input,
        primary,
        requestId,
        signal,
        response,
        state,
      )
      return { completion, adapter: primary }
    } catch (error) {
      if (state.firstTokenAt !== undefined || signal.aborted) throw error

      const fallback = this.failover.resolve(input.model, error, input.comparison === true)
      if (!fallback) throw error

      delete state.providerRequestId
      delete state.usage
      const completion = await this.pipeAdapterStreamWithHealth(
        input,
        fallback,
        requestId,
        signal,
        response,
        state,
      )
      return {
        completion,
        adapter: fallback,
        failover: {
          from: primary.id,
          to: fallback.id,
          reason: error instanceof ChatAdapterError ? error.code : 'UPSTREAM_FAILURE',
        },
      }
    }
  }

  private writeCompletion(
    input: ChatCompletionRequestDto,
    requestId: string,
    completion: ChatStreamCompletion,
    response: Response,
  ): void {
    const id = `chatcmpl-${requestId}`
    const created = Math.floor(Date.now() / 1_000)

    const finishPayload: ChatSseDeltaPayload = {
      id,
      object: 'chat.completion.chunk',
      created,
      model: input.model,
      request_id: requestId,
      choices: [{ index: 0, delta: {}, finish_reason: completion.finishReason }],
    }
    const usagePayload: ChatSseUsagePayload = {
      id,
      object: 'chat.completion.usage',
      created,
      model: input.model,
      request_id: requestId,
      choices: [],
      usage: {
        prompt_tokens: completion.usage.inputTokens,
        completion_tokens: completion.usage.outputTokens,
        total_tokens: completion.usage.totalTokens,
        aigateway: {
          estimated_cost_cny: null,
          usage_unknown: completion.usage.usageUnknown,
        },
      },
    }

    writeChatSsePayload(response, finishPayload)
    writeChatSsePayload(response, usagePayload)
    writeChatSseDone(response)
  }

  private protocolError(message: string): ChatAdapterError {
    return new ChatAdapterError(message, {
      code: 'ADAPTER_PROTOCOL_ERROR',
      retryable: false,
    })
  }

  private toErrorPayload(error: unknown, requestId: string): ChatSseErrorPayload {
    const normalized = this.normalizeError(error)

    return {
      object: 'chat.completion.error',
      request_id: requestId,
      error: { requestId, ...normalized },
    }
  }

  private toLifecycleError(error: unknown) {
    const normalized = this.normalizeError(error)
    return {
      code: normalized.code,
      message: normalized.message,
      details: { retryable: normalized.retryable },
    }
  }

  private normalizeError(error: unknown) {
    if (
      error instanceof RequestLifecycleFinishError ||
      error instanceof RequestLifecycleTransitionError
    ) {
      return {
        code: 'REQUEST_FINALIZATION_FAILED',
        message: '请求终结记录写入失败',
        retryable: true,
      }
    }
    if (error instanceof ChatAdapterError) {
      return { code: error.code, message: error.message, retryable: error.retryable }
    }
    return { code: 'CHAT_STREAM_ERROR', message: 'Chat 流处理失败', retryable: true }
  }

  private abortError(): DOMException {
    return new DOMException('The operation was aborted', 'AbortError')
  }

  private canWrite(response: Response): boolean {
    return !response.destroyed && !response.writableEnded
  }
}
