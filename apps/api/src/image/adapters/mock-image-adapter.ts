import { Inject, Injectable } from '@nestjs/common'

import type {
  ImageAdapter,
  ImageAdapterDownload,
  ImageAdapterDownloadRequest,
  ImageAdapterStatus,
  ImageAdapterStatusRequest,
  ImageAdapterSubmission,
  ImageAdapterSubmitRequest,
} from './image-adapter'
import { ImageAdapterError } from './image-adapter'

export interface MockImageAdapterOptions {
  outcome: 'success' | 'failure' | 'timeout'
  pollsBeforeTerminal: number
  failSubmit: boolean
}

export const MOCK_IMAGE_ADAPTER_OPTIONS = Symbol('MOCK_IMAGE_ADAPTER_OPTIONS')
export const DEFAULT_MOCK_IMAGE_ADAPTER_OPTIONS: MockImageAdapterOptions = {
  outcome: 'success',
  pollsBeforeTerminal: 2,
  failSubmit: false,
}

const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
)

@Injectable()
export class MockImageAdapter implements ImageAdapter {
  readonly id = 'mock' as const
  readonly resolvedModel = 'mock-image-v1'
  private readonly polls = new Map<string, number>()

  constructor(
    @Inject(MOCK_IMAGE_ADAPTER_OPTIONS) private readonly options: MockImageAdapterOptions,
  ) {}

  async submit(request: ImageAdapterSubmitRequest): Promise<ImageAdapterSubmission> {
    throwIfAborted(request.signal)
    if (this.options.failSubmit) {
      throw new ImageAdapterError('Mock image submission failed', {
        code: 'MOCK_IMAGE_SUBMIT_FAILED',
        retryable: true,
        statusCode: 503,
      })
    }

    const providerTaskId = `mock-image-${request.requestId}`
    this.polls.set(providerTaskId, 0)
    return { providerTaskId, status: 'pending' }
  }

  async getStatus(request: ImageAdapterStatusRequest): Promise<ImageAdapterStatus> {
    throwIfAborted(request.signal)
    if (!this.polls.has(request.providerTaskId)) {
      throw new ImageAdapterError('Mock image task was not found', {
        code: 'MOCK_IMAGE_TASK_NOT_FOUND',
        retryable: false,
        statusCode: 404,
      })
    }
    if (this.options.outcome === 'timeout') return waitForAbort(request.signal)

    const poll = (this.polls.get(request.providerTaskId) ?? 0) + 1
    this.polls.set(request.providerTaskId, poll)
    if (poll < this.options.pollsBeforeTerminal) return { status: 'running' }
    if (this.options.outcome === 'failure') {
      return {
        status: 'failed',
        errorCode: 'MOCK_IMAGE_GENERATION_FAILED',
        errorMessage: 'Mock image generation failed',
      }
    }

    return {
      status: 'succeeded',
      results: [
        {
          url: `mock://image/${request.providerTaskId}/0`,
          width: 1,
          height: 1,
          contentType: 'image/png',
        },
      ],
    }
  }

  async download(request: ImageAdapterDownloadRequest): Promise<ImageAdapterDownload> {
    throwIfAborted(request.signal)
    if (!request.url.startsWith('mock://image/')) {
      throw new ImageAdapterError('Mock image URL is not allowed', {
        code: 'MOCK_IMAGE_URL_NOT_ALLOWED',
        retryable: false,
      })
    }
    return { body: ONE_PIXEL_PNG, contentType: 'image/png' }
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('The operation was aborted', 'AbortError')
}

async function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener(
      'abort',
      () => reject(new DOMException('The operation was aborted', 'AbortError')),
      { once: true },
    )
  })
}
