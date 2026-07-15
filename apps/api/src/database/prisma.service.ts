import { Inject, Injectable } from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ConfigService) config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: config.get<number>('DATABASE_POOL_MAX') ?? 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
    })
    super({ adapter })
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  async ping() {
    await this.$queryRawUnsafe('SELECT 1')
  }
}
