/**
 * Utilities for constructing asset URLs
 */

import { api } from '@/scripts/api'
import type { AssetItem } from '../schemas/assetSchema'
import { getAssetType } from './assetTypeUtil'

/**
 * Get the download/view URL for an asset.
 * Cloud assets with asset_hash use `/view?filename={asset_hash}`.
 * OSS assets use `/view?filename={name}&type={type}&subfolder={subfolder}`.
 */
export function getAssetUrl(
  asset: AssetItem,
  defaultType: 'input' | 'output' = 'output'
): string {
  if (asset.asset_hash) {
    const params = new URLSearchParams({ filename: asset.asset_hash })
    return api.apiURL(`/view?${params}`)
  }

  const assetType = getAssetType(asset, defaultType)
  const subfolder = asset.user_metadata?.subfolder
  const params = new URLSearchParams()
  params.set('filename', asset.name)
  params.set('type', assetType)
  if (typeof subfolder === 'string' && subfolder) {
    params.set('subfolder', subfolder)
  }
  return api.apiURL(`/view?${params}`)
}
