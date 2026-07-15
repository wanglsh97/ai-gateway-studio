import { Inject, Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient } from 'redis'

const INCREMENT_FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`

export interface FixedWindowCounter {
  count: number
  retryAfterSeconds: number
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private readonly client: ReturnType<typeof createClient>
  private connectPromise: Promise<unknown> | null = null

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = createClient({
      url: config.getOrThrow<string>('REDIS_URL'),
      socket: {
        connectTimeout: 2_000,
        reconnectStrategy: false,
      },
    })
    this.client.on('error', (error: Error) => {
      this.logger.error({ error }, 'Redis client error')
    })
  }

  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit()
  }

  async ping() {
    await this.ensureConnected()
    await this.client.ping()
  }

  async incrementFixedWindow(key: string, windowSeconds: number): Promise<FixedWindowCounter> {
    await this.ensureConnected()
    const result = await this.client.eval(INCREMENT_FIXED_WINDOW_SCRIPT, {
      keys: [key],
      arguments: [String(windowSeconds)],
    })

    if (
      !Array.isArray(result) ||
      result.length !== 2 ||
      typeof result[0] !== 'number' ||
      typeof result[1] !== 'number'
    ) {
      throw new Error('Redis rate-limit script returned an invalid result')
    }

    return {
      count: result[0],
      retryAfterSeconds: Math.max(1, result[1]),
    }
  }

  private async ensureConnected() {
    if (this.client.isOpen) return

    this.connectPromise ??= this.client.connect().finally(() => {
      this.connectPromise = null
    })
    await this.connectPromise
  }
}
