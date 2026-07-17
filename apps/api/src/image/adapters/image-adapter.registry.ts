import { Inject, Injectable } from '@nestjs/common'

import type { ImageAdapterId } from '../image.constants'
import type { ImageAdapter } from './image-adapter'

export const IMAGE_ADAPTERS = Symbol('IMAGE_ADAPTERS')

@Injectable()
export class ImageAdapterRegistry {
  private readonly adapters: ReadonlyMap<ImageAdapterId, ImageAdapter>

  constructor(@Inject(IMAGE_ADAPTERS) adapters: readonly ImageAdapter[]) {
    const byId = new Map<ImageAdapterId, ImageAdapter>()
    for (const adapter of adapters) {
      if (byId.has(adapter.id)) throw new Error(`Image adapter "${adapter.id}" is duplicated`)
      byId.set(adapter.id, adapter)
    }
    this.adapters = byId
  }

  has(id: ImageAdapterId): boolean {
    return this.adapters.has(id)
  }

  get(id: ImageAdapterId): ImageAdapter {
    const adapter = this.adapters.get(id)
    if (!adapter) throw new Error(`Image adapter "${id}" is not registered`)
    return adapter
  }

  list(): readonly ImageAdapter[] {
    return [...this.adapters.values()]
  }
}
