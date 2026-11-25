import type { AssetItem } from '@comfyorg/assets-core/schema'

import { isCloud } from '@/platform/distribution/types'

export function getAssetStoredFilename(
  asset: AssetItem,
  hash = asset.hash
): string {
  return isCloud && hash ? hash : asset.name
}
