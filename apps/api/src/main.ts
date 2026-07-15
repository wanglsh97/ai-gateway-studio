import 'reflect-metadata'

import { randomUUID } from 'node:crypto'

import { RequestMethod, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import pinoHttp from 'pino-http'

import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { createPinoHttpOptions } from './config/logger.config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService)

  app.useLogger(app.get(Logger))
  app.use(pinoHttp(createPinoHttpOptions()))
  app.getHttpAdapter().getInstance().disable('x-powered-by')
  app.enableShutdownHooks()
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  })
  app.enableCors({
    origin: config.getOrThrow<string>('WEB_ORIGIN'),
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())

  const port = config.getOrThrow<number>('API_PORT')
  await app.listen(port)
}

void bootstrap().catch((error: unknown) => {
  const failureId = randomUUID()
  console.error(`API 启动失败，failureId=${failureId}`, error)
  process.exitCode = 1
})
