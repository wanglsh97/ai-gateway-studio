import type { GatewayError } from './types.js'

export class AIGatewayError extends Error implements GatewayError {
  readonly requestId: string
  readonly code: string
  readonly retryable: boolean
  readonly details?: Record<string, unknown>
  readonly status?: number

  constructor(error: GatewayError, options: { status?: number; cause?: unknown } = {}) {
    super(error.message, { cause: options.cause })
    this.name = 'AIGatewayError'
    this.requestId = error.requestId
    this.code = error.code
    this.retryable = error.retryable
    if (error.details !== undefined) this.details = error.details
    if (options.status !== undefined) this.status = options.status
  }
}

export class AIGatewayProtocolError extends AIGatewayError {
  constructor(requestId: string, message: string, cause?: unknown) {
    super(
      {
        requestId,
        code: 'INVALID_STREAM_RESPONSE',
        message,
        retryable: true,
      },
      { cause },
    )
    this.name = 'AIGatewayProtocolError'
  }
}

export class AIGatewayFeatureUnavailableError extends AIGatewayError {
  constructor(feature: string) {
    super({
      requestId: 'unavailable',
      code: 'SDK_FEATURE_UNAVAILABLE',
      message: `SDK feature "${feature}" is not implemented yet`,
      retryable: false,
    })
    this.name = 'AIGatewayFeatureUnavailableError'
  }
}
