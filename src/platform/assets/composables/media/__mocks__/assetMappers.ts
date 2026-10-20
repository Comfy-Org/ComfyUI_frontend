import { vi } from 'vitest'

import type {
  mapInputFileToAssetItem as MapInputFileToAssetItem,
  mapTaskOutputToAssetItem as MapTaskOutputToAssetItem
} from '@/platform/assets/composables/media/assetMappers'

export const mapInputFileToAssetItem = vi.fn<typeof MapInputFileToAssetItem>()
export const mapTaskOutputToAssetItem = vi.fn<typeof MapTaskOutputToAssetItem>()
