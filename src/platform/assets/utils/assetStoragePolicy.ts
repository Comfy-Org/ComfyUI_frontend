import type { AssetItem } from '@comfyorg/assets-core/schema'

import { isCloud } from '@/platform/distribution/types'

export function getAssetStoredFilename(asset: AssetItem): string {
  return isCloud && asset.hash ? asset.hash : asset.name
}
