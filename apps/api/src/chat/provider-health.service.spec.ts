import { ConfigService } from '@nestjs/config'

import type { RedisService } from '../redis/redis.service'
import { ProviderHealthService } from './provider-health.service'

function createService(options: { threshold?: number; initial?: unknown } = {}) {
  let stored = options.initial === undefined ? null : JSON.stringify(options.initial)
  const redis = {
    get: jest.fn(async () => stored),
    setWithTtl: jest.fn(async (_key: string, value: string) => {
      stored = value
    }),
  } as unknown as RedisService
  const config = new ConfigService({
    PROVIDER_HEALTH_TTL_SECONDS: 120,
    PROVIDER_HEALTH_FAILURE_THRESHOLD: options.threshold ?? 3,
  })

  return { redis, service: new ProviderHealthService(redis, config), stored: () => stored }
}

describe('ProviderHealthService', () => {
  it('projects success as healthy with a TTL and resets consecutive failures', async () => {
    const { redis, service, stored } = createService({
      initial: {
        status: 'unhealthy',
        consecutiveFailures: 3,
        averageLatencyMs: 100,
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    })

    await service.recordSuccess('qwen', 200)

    expect(redis.setWithTtl).toHaveBeenCalledWith('provider:health:qwen', expect.any(String), 120)
    expect(JSON.parse(stored()!)).toEqual(
      expect.objectContaining({
        status: 'healthy',
        consecutiveFailures: 0,
        averageLatencyMs: 125,
      }),
    )
    await expect(service.getStatus('qwen')).resolves.toBe('healthy')
  })

  it('marks a provider unhealthy only after the configured impacting-failure threshold', async () => {
    const { service } = createService({ threshold: 2 })

    await service.recordFailure('glm', 50, { code: 'UPSTREAM_TIMEOUT', affectsHealth: true })
    await expect(service.getStatus('glm')).resolves.toBe('unknown')

    await service.recordFailure('glm', 70, { code: 'UPSTREAM_503', affectsHealth: true })
    await expect(service.getStatus('glm')).resolves.toBe('unhealthy')
  })

  it('records business 4xx without incrementing health failures', async () => {
    const { service, stored } = createService({
      initial: {
        status: 'healthy',
        consecutiveFailures: 1,
        averageLatencyMs: 100,
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    })

    await service.recordFailure('deepseek', 80, {
      code: 'UPSTREAM_BAD_REQUEST',
      affectsHealth: false,
    })

    expect(JSON.parse(stored()!)).toEqual(
      expect.objectContaining({
        status: 'healthy',
        consecutiveFailures: 1,
        lastErrorCode: 'UPSTREAM_BAD_REQUEST',
      }),
    )
  })

  it('returns unknown when the TTL projection is absent or Redis is unavailable', async () => {
    const { service } = createService()
    await expect(service.getStatus('qwen')).resolves.toBe('unknown')

    const redis = {
      get: jest.fn().mockRejectedValue(new Error('offline')),
    } as unknown as RedisService
    const unavailable = new ProviderHealthService(redis, new ConfigService())
    await expect(unavailable.getStatus('qwen')).resolves.toBe('unknown')
  })
})
