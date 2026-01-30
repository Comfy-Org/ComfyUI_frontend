import type { AssetItem } from '../schemas/assetSchema'
import type { AssetDropdownItem } from '../types/assetDropdownTypes'

/**
 * Transforms an AssetItem to AssetDropdownItem for dropdown display.
 */
export function toAssetDropdownItem(asset: AssetItem): AssetDropdownItem {
  return {
    id: asset.id,
    name: (asset.user_metadata?.filename as string | undefined) ?? asset.name,
    label: asset.name,
    previewUrl: asset.preview_url ?? ''
  }
}
