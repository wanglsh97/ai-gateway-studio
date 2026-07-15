import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'

import { AppController } from './app.controller'
import { validateEnvironment } from './config/env.validation'
import { createPinoHttpOptions } from './config/logger.config'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { RedisModule } from './redis/redis.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpOptions(),
      forRoutes: [],
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
