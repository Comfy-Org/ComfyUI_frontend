/**
 * Utilities for working with asset types
 */

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

/** Asset type from its preview URL, else its first tag, else `defaultType`. */
export function getAssetType(
  asset: Pick<AssetItem, 'preview_url' | 'tags'>,
  defaultType: 'input' | 'output' = 'output'
): string {
  const urlType = new URLSearchParams(
    (asset.preview_url ?? '').split('?')[1] ?? ''
  ).get('type')
  return urlType || asset.tags[0] || defaultType
}
