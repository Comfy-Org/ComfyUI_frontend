/**
 * Utilities for constructing asset URLs
 */

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { api } from '@/scripts/api'

import { getOutputAssetMetadata } from '../schemas/assetMetadataSchema'
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

/**
 * Id of the assets-API asset holding this item's own file. A card grouped per
 * job carries the job id as its `id` and keeps its own asset id in metadata.
 */
export function getAssetContentId(
  asset: Pick<AssetItem, 'id' | 'user_metadata'>
): string {
  return getOutputAssetMetadata(asset.user_metadata)?.assetId || asset.id
}

/**
 * URL of the asset's own file, for downloading or loading it whole.
 *
 * With the assets API enabled the file is served by id, so no path inference
 * is needed and a preview that is only a thumbnail is never mistaken for the
 * file. Otherwise the item came from the history API, whose `preview_url`
 * already points at the file, with a `/view` URL as fallback.
 *
 * `disposition: 'inline'` asks the assets-API content endpoint to serve the
 * file for in-page rendering (e.g. a `<video>` source) instead of its
 * default `attachment` disposition, which browsers try to save rather than
 * play. It has no effect on the history-backed fallback, whose `/view`
 * endpoint has no such distinction.
 */
export function getAssetFileUrl(
  asset: AssetItem,
  options?: { disposition?: 'inline' | 'attachment' }
): string {
  if (useFeatureFlags().flags.assetsEnabled) {
    const query = options?.disposition
      ? `?disposition=${options.disposition}`
      : ''
    return api.apiURL(`/assets/${getAssetContentId(asset)}/content${query}`)
  }
  return asset.preview_url || getAssetUrl(asset)
}
