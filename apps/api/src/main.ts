import 'reflect-metadata'

import { randomUUID } from 'node:crypto'

import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { configureApplication } from './configure-app'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService)

  configureApplication(app)

  const port = config.getOrThrow<number>('API_PORT')
  await app.listen(port)
}

void bootstrap().catch((error: unknown) => {
  const failureId = randomUUID()
  console.error(`API 启动失败，failureId=${failureId}`, error)
  process.exitCode = 1
})
