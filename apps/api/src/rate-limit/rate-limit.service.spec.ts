import { HttpStatus, Logger } from '@nestjs/common'

import type { RedisService } from '../redis/redis.service'
import {
  normalizeClientIp,
  RateLimitExceededException,
  RateLimitService,
} from './rate-limit.service'

function createService(limit = 2) {
  const incrementFixedWindow = jest.fn()
  const redis = { incrementFixedWindow } as unknown as RedisService
  const config = {
    getOrThrow: jest.fn().mockReturnValue(limit),
    get: jest.fn().mockReturnValue(5),
  }
  const service = new RateLimitService(redis, config as never)
  return { incrementFixedWindow, service }
}

describe('RateLimitService', () => {
  it('uses an opaque normalized-IP key and a 60 second atomic window', async () => {
    const { incrementFixedWindow, service } = createService()
    incrementFixedWindow.mockResolvedValue({ count: 1, retryAfterSeconds: 60 })

    await expect(service.consumeChat('::ffff:127.0.0.1')).resolves.toBeUndefined()

    expect(incrementFixedWindow).toHaveBeenCalledWith('rate:chat:MTI3LjAuMC4x', 60)
  })

  it('uses a separate image counter with the configured five-per-minute default', async () => {
    const { incrementFixedWindow, service } = createService()
    incrementFixedWindow.mockResolvedValue({ count: 5, retryAfterSeconds: 20 })

    await expect(service.consumeImage('127.0.0.1')).resolves.toBeUndefined()
    expect(incrementFixedWindow).toHaveBeenCalledWith('rate:image:MTI3LjAuMC4x', 60)
  })

  it('returns 429 with retry information after the configured limit', async () => {
    const { incrementFixedWindow, service } = createService(1)
    incrementFixedWindow.mockResolvedValue({ count: 2, retryAfterSeconds: 37 })

    await expect(service.consumeChat('203.0.113.8')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      retryAfterSeconds: 37,
    })
  })

  it('fails closed with 503 when Redis is unavailable', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation()
    const { incrementFixedWindow, service } = createService()
    incrementFixedWindow.mockRejectedValue(new Error('redis unavailable'))

    await expect(service.consumeChat('203.0.113.8')).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    })
    jest.restoreAllMocks()
  })

  it('normalizes IPv4-mapped addresses and never returns an empty identity', () => {
    expect(normalizeClientIp('::ffff:192.0.2.10')).toBe('192.0.2.10')
    expect(normalizeClientIp(' 2001:db8::1 ')).toBe('2001:db8::1')
    expect(normalizeClientIp(undefined)).toBe('unknown')
  })

  it('exposes a dedicated exceeded exception type', () => {
    expect(new RateLimitExceededException(12).getStatus()).toBe(429)
  })
})
