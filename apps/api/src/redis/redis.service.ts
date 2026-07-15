import { Inject, Injectable, Logger } from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient } from 'redis'

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

  private async ensureConnected() {
    if (this.client.isOpen) return

    this.connectPromise ??= this.client.connect().finally(() => {
      this.connectPromise = null
    })
    await this.connectPromise
  }
}
