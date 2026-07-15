import type { IncomingMessage, ServerResponse } from 'node:http'

import { createPinoHttpOptions } from './logger.config'

describe('request ID generation', () => {
  it('preserves a valid UUID request ID', () => {
    const incomingId = '00000000-0000-4000-8000-000000000004'
    const response = { setHeader: jest.fn() } as unknown as ServerResponse

    const requestId = createPinoHttpOptions().genReqId(
      { headers: { 'x-request-id': incomingId } } as unknown as IncomingMessage,
      response,
    )

    expect(requestId).toBe(incomingId)
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', incomingId)
  })

  it('replaces a non-UUID request ID before it reaches PostgreSQL', () => {
    const response = { setHeader: jest.fn() } as unknown as ServerResponse

    const requestId = createPinoHttpOptions().genReqId(
      { headers: { 'x-request-id': 'not-a-uuid' } } as unknown as IncomingMessage,
      response,
    )

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', requestId)
  })
})
