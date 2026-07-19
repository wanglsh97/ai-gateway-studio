import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { RateLimitModule } from '../rate-limit/rate-limit.module'
import { UserAuthModule } from '../user-auth/user-auth.module'
import { CogViewImageAdapter } from './adapters/cogview-image-adapter'
import type { ImageAdapter } from './adapters/image-adapter'
import { IMAGE_ADAPTERS, ImageAdapterRegistry } from './adapters/image-adapter.registry'
import {
  DEFAULT_MOCK_IMAGE_ADAPTER_OPTIONS,
  MOCK_IMAGE_ADAPTER_OPTIONS,
  MockImageAdapter,
} from './adapters/mock-image-adapter'
import { ImageController } from './image.controller'
import { ImageService } from './image.service'
import { WanxiangImageAdapter } from './adapters/wanxiang-image-adapter'

@Module({
  imports: [ConfigModule, RateLimitModule, UserAuthModule],
  providers: [
    { provide: MOCK_IMAGE_ADAPTER_OPTIONS, useValue: DEFAULT_MOCK_IMAGE_ADAPTER_OPTIONS },
    MockImageAdapter,
    {
      provide: IMAGE_ADAPTERS,
      inject: [ConfigService, MockImageAdapter],
      useFactory: (config: ConfigService, mock: MockImageAdapter): readonly ImageAdapter[] => {
        const adapters: ImageAdapter[] = []
        if (config.get<boolean>('MOCK_PROVIDER_ENABLED')) adapters.push(mock)
        if (config.get<boolean>('WANXIANG_ENABLED')) {
          adapters.push(
            new WanxiangImageAdapter({
              apiKey: config.getOrThrow<string>('WANXIANG_API_KEY'),
              baseUrl: config.getOrThrow<string>('WANXIANG_BASE_URL'),
              modelId: config.getOrThrow<string>('WANXIANG_MODEL_ID'),
            }),
          )
        }
        if (config.get<boolean>('COGVIEW_ENABLED')) {
          adapters.push(
            new CogViewImageAdapter({
              apiKey: config.getOrThrow<string>('COGVIEW_API_KEY'),
              baseUrl: config.getOrThrow<string>('COGVIEW_BASE_URL'),
              modelId: config.getOrThrow<string>('COGVIEW_MODEL_ID'),
            }),
          )
        }
        return adapters
      },
    },
    ImageAdapterRegistry,
    ImageService,
  ],
  controllers: [ImageController],
  exports: [ImageAdapterRegistry],
})
export class ImageModule {}
