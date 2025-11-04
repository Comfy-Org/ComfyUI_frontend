import type { AssetContext } from '@/platform/assets/schemas/mediaAssetSchema'

/**
 * Extract asset type from tags array
 * @param tags The tags array from AssetItem
 * @returns The asset type ('input' or 'output')
 */
export function getAssetType(tags?: string[]): AssetContext['type'] {
  const tag = tags?.[0]
  if (tag === 'output') return 'output'
  return 'input'
}
