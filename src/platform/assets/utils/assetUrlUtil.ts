/**
 * Utilities for constructing asset URLs
 */

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isMediaRoute } from '@/platform/auth/session/sessionMediaUrl'
import { api } from '@/scripts/api'
import { isResultItemType } from '@/utils/typeGuardUtil'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetType } from './assetTypeUtil'

/** `/view` URL of the asset, typed by its preview URL or tags and placed in its subfolder. */
export function getAssetUrl(
  asset: Pick<AssetItem, 'name' | 'tags' | 'preview_url' | 'user_metadata'>,
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

/** `/view` URL of the asset's own file, not its preview. */
export function getAssetViewUrl(asset: AssetItem): string {
  const root = asset.tags.find(isResultItemType)
  if (!asset.loader_path || !root) return getAssetUrl(asset)
  const slash = asset.loader_path.lastIndexOf('/')
  const params = new URLSearchParams({
    filename: asset.loader_path.slice(slash + 1),
    type: root
  })
  if (slash > 0) params.set('subfolder', asset.loader_path.slice(0, slash))
  return api.apiURL(`/view?${params}`)
}

/** Subfolder of the asset under its type root, or `''` at the root. */
export function getAssetSubfolder(
  asset: Pick<AssetItem, 'preview_url' | 'user_metadata'>
): string {
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

/** URL of the asset's own file: its assets-API content route, else its history `/view` URL. */
export function getAssetFileUrl(
  asset: Pick<
    AssetItem,
    'id' | 'name' | 'tags' | 'preview_url' | 'user_metadata'
  >,
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

/**
 * The `api.fetchApi` route of a media URL on this page's own API, or
 * `undefined` for any other URL, which must not be sent credentials.
 */
export function getApiMediaRoute(href: string): string | undefined {
  const url = URL.parse(href, window.location.origin)
  const apiBase = new URL(api.apiURL(''), window.location.origin)
  const basePath = apiBase.pathname.replace(/\/$/, '')
  if (url?.origin !== apiBase.origin) return undefined
  if (!url.pathname.startsWith(`${basePath}/`)) return undefined
  const route = `${url.pathname.slice(basePath.length)}${url.search}`
  const isUnambiguous =
    !url.pathname.includes('%') && !route.startsWith('/api/')
  return isUnambiguous && isMediaRoute(route) ? route : undefined
}
