import { RequestMethod, ValidationPipe } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'

import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { createPinoHttpOptions } from './config/logger.config'

export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService)

  app.useLogger(app.get(Logger))
  app.use(pinoHttp(createPinoHttpOptions()))
  app.use(cookieParser())
  app.getHttpAdapter().getInstance().disable('x-powered-by')
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', config.getOrThrow<number>('TRUSTED_PROXY_HOPS'))
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
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())
}
