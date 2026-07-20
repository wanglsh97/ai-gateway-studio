import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'

import { AppController } from './app.controller'
import { AdminAuthModule } from './admin/auth/admin-auth.module'
import { AdminDashboardModule } from './admin/dashboard/admin-dashboard.module'
import { AdminRequestLogsModule } from './admin/logs/admin-request-logs.module'
import { AdminTablesModule } from './admin/tables/admin-tables.module'
import { AgentModule } from './agent/agent.module'
import { ChatModule } from './chat/chat.module'
import { validateEnvironment } from './config/env.validation'
import { createPinoHttpOptions } from './config/logger.config'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { ImageModule } from './image/image.module'
import { PromptModule } from './prompt/prompt.module'
import { RedisModule } from './redis/redis.module'
import { UserAuthModule } from './user-auth/user-auth.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpOptions(),
      forRoutes: [],
    }),
    DatabaseModule,
    RedisModule,
    UserAuthModule,
    HealthModule,
    ChatModule,
    ImageModule,
    PromptModule,
    AgentModule,
    AdminAuthModule,
    AdminDashboardModule,
    AdminRequestLogsModule,
    AdminTablesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
