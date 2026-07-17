import type { ImageModelAlias } from '@aigateway/sdk'

export const IMAGE_MODEL_ALIASES = [
  'wanxiang',
  'cogview',
] as const satisfies readonly ImageModelAlias[]

export const IMAGE_ADAPTER_IDS = ['mock', ...IMAGE_MODEL_ALIASES] as const
export type ImageAdapterId = (typeof IMAGE_ADAPTER_IDS)[number]

export function isImageModelAlias(value: string): value is ImageModelAlias {
  return (IMAGE_MODEL_ALIASES as readonly string[]).includes(value)
}
