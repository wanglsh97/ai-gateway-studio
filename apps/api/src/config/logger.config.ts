import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

export function createPinoHttpOptions() {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        '*.apiKey',
        '*.api_key',
        '*.password',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
    genReqId(request: IncomingMessage, response: ServerResponse) {
      const incomingId = request.headers['x-request-id']
      const requestId =
        typeof incomingId === 'string' && incomingId.length > 0 ? incomingId : randomUUID()
      response.setHeader('x-request-id', requestId)
      return requestId
    },
    customLogLevel(_request: IncomingMessage, response: ServerResponse, error?: Error) {
      if (error || response.statusCode >= 500) return 'error' as const
      if (response.statusCode >= 400) return 'warn' as const
      return 'info' as const
    },
  }
}
