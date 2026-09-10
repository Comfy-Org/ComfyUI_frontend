import { vi } from 'vitest'

import type {
  mapInputFileToAssetItem as MapInputFileToAssetItem,
  mapTaskOutputToAssetItem as MapTaskOutputToAssetItem
} from '../assetMappers'

export const mapInputFileToAssetItem = vi.fn<typeof MapInputFileToAssetItem>()
export const mapTaskOutputToAssetItem = vi.fn<typeof MapTaskOutputToAssetItem>()
