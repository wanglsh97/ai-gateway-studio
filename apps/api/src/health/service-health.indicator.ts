import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'

import { PrismaService } from '../database/prisma.service'
import { RedisService } from '../redis/redis.service'

@Injectable()
export class ServiceHealthIndicator {
  constructor(
    @Inject(HealthIndicatorService) private readonly indicators: HealthIndicatorService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  async postgresql() {
    const indicator = this.indicators.check('postgresql')
    try {
      await this.prisma.ping()
      return indicator.up()
    } catch (error) {
      return indicator.down({ message: this.failureMessage(error) })
    }
  }

  async redis() {
    const indicator = this.indicators.check('redis')
    try {
      await this.redisService.ping()
      return indicator.up()
    } catch (error) {
      return indicator.down({ message: this.failureMessage(error) })
    }
  }

  private failureMessage(error: unknown) {
    return error instanceof Error ? error.message : 'dependency unavailable'
  }
}
