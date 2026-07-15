import { randomUUID } from 'node:crypto'

import type {
  ChatFinishReason,
  ChatSseDeltaPayload,
  ChatSseErrorPayload,
  ChatSseUsagePayload,
} from '@aigateway/sdk'
import { Body, Controller, Post, Req, Res, ServiceUnavailableException } from '@nestjs/common'
import type { Request, Response } from 'express'

import { RequestLifecycleService } from '../request-lifecycle/request-lifecycle.service'
import { ChatAdapterError } from './adapters/chat-adapter'
import type { ChatAdapter, ChatAdapterUsage } from './adapters/chat-adapter'
import {
  ChatAdapterNotRegisteredError,
  ChatAdapterRegistry,
} from './adapters/chat-adapter.registry'
import { writeChatSseDone, writeChatSsePayload } from './chat-sse.writer'
import { ChatCompletionRequestDto } from './dto/chat-completion-request.dto'

type RequestWithId = Request & { id?: string }

@Controller('chat')
export class ChatController {
  constructor(
    private readonly adapters: ChatAdapterRegistry,
    private readonly lifecycle: RequestLifecycleService,
  ) {}

  @Post('completions')
  async create(
    @Body() input: ChatCompletionRequestDto,
    @Req() request: RequestWithId,
    @Res() response: Response,
  ): Promise<void> {
    const requestId = request.id ?? randomUUID()
    const adapter = this.resolveAdapter()

    await this.lifecycle.start({
      requestId,
      capability: 'chat',
      prompt: {
        messages: input.messages.map(({ role, content }) => ({ role, content })),
      },
      modelAlias: input.model,
      provider: adapter.id,
      resolvedModel: 'mock-chat-v1',
      stream: true,
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

    try {
      await this.pipeAdapterStream(input, adapter, requestId, abortController.signal, response)
    } catch (error) {
      if (!abortController.signal.aborted && this.canWrite(response)) {
        writeChatSsePayload(response, this.toErrorPayload(error, requestId))
      }
    } finally {
      request.removeListener('aborted', abort)
      response.removeListener('close', abortOnResponseClose)
      if (this.canWrite(response)) response.end()
    }
  }

  private resolveAdapter(): ChatAdapter {
    try {
      return this.adapters.get('mock')
    } catch (error) {
      if (error instanceof ChatAdapterNotRegisteredError) {
        throw new ServiceUnavailableException('当前没有可用的 Chat 模型')
      }
      throw error
    }
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
  ): Promise<void> {
    const id = `chatcmpl-${requestId}`
    const created = Math.floor(Date.now() / 1_000)
    let firstDelta = true
    let usage: ChatAdapterUsage | undefined
    let finishReason: ChatFinishReason | undefined

    for await (const event of adapter.stream({
      requestId,
      modelAlias: input.model,
      resolvedModel: 'mock-chat-v1',
      messages: input.messages,
      signal,
      ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
      ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }),
    })) {
      if (event.type === 'delta') {
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
        if (usage) throw this.protocolError('Adapter emitted usage more than once')
        usage = event.usage
        continue
      }

      if (finishReason) throw this.protocolError('Adapter emitted finish more than once')
      finishReason = event.finishReason
    }

    if (!finishReason) throw this.protocolError('Adapter stream ended without finish')
    if (!usage) throw this.protocolError('Adapter stream ended without usage')

    const finishPayload: ChatSseDeltaPayload = {
      id,
      object: 'chat.completion.chunk',
      created,
      model: input.model,
      request_id: requestId,
      choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
    }
    const usagePayload: ChatSseUsagePayload = {
      id,
      object: 'chat.completion.usage',
      created,
      model: input.model,
      request_id: requestId,
      choices: [],
      usage: {
        prompt_tokens: usage.inputTokens,
        completion_tokens: usage.outputTokens,
        total_tokens: usage.totalTokens,
        aigateway: {
          estimated_cost_cny: null,
          usage_unknown: usage.usageUnknown,
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
    const normalized =
      error instanceof ChatAdapterError
        ? { code: error.code, message: error.message, retryable: error.retryable }
        : { code: 'CHAT_STREAM_ERROR', message: 'Chat 流处理失败', retryable: true }

    return {
      object: 'chat.completion.error',
      request_id: requestId,
      error: { requestId, ...normalized },
    }
  }

  private canWrite(response: Response): boolean {
    return !response.destroyed && !response.writableEnded
  }
}
