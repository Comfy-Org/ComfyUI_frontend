/**
 * Utilities for constructing asset URLs
 */

import { api } from '@/scripts/api'
import type { AssetItem } from '../schemas/assetSchema'
import { getAssetType } from './assetTypeUtil'

/**
 * Get the download/view URL for an asset
 * Constructs the proper URL with filename encoding, type, and subfolder parameters
 *
 * @param asset The asset to get URL for
 * @param defaultType Default type if asset doesn't have tags (default: 'output')
 * @returns Full URL for viewing/downloading the asset
 *
 * @example
 * const url = getAssetUrl(asset)
 * downloadFile(url, asset.name)
 */
export function getAssetUrl(
  asset: AssetItem,
  defaultType: 'input' | 'output' = 'output'
): string {
  const assetType = getAssetType(asset, defaultType)
  const subfolder = getAssetSubfolder(asset)
  const params = new URLSearchParams()
  params.set('filename', asset.name)
  params.set('type', assetType)
  if (subfolder) {
    params.set('subfolder', subfolder)
  }
  return api.apiURL(`/view?${params}`)
}

/**
 * Get the subfolder an asset lives in, relative to its type root
 *
 * Reads `preview_url` first and falls back to `user_metadata`, mirroring how
 * {@link getAssetType} resolves the type.
 *
 * @param asset The asset to get the subfolder for
 * @returns The subfolder, or an empty string when the asset is at the root
 */
export function getAssetSubfolder(asset: AssetItem): string {
  const previewSubfolder = new URLSearchParams(
    (asset.preview_url ?? '').split('?')[1] ?? ''
  ).get('subfolder')
  if (previewSubfolder) return previewSubfolder

  const { subfolder } = asset.user_metadata ?? {}
  return typeof subfolder === 'string' ? subfolder : ''
}
