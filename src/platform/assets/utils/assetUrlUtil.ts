/**
 * Utilities for constructing asset URLs
 */

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  isMediaRoute,
  scopeMediaRoute
} from '@/platform/auth/session/sessionMediaUrl'
import { webSessionRequests } from '@/platform/auth/session/webSessionFetch'
import { isCloud } from '@/platform/distribution/types'
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

/**
 * URL for loading the asset's own video or audio file into a `<video>` or
 * `<audio>` `src`, which sends cookies but no headers.
 *
 * On Cloud, a cookie-authenticated `/assets/:id/content` request is looked up
 * in the session's default workspace only, so it 404s for an asset that lives
 * in another workspace. `/view` looks across the user's workspaces, so an
 * asset with a content hash is loaded through `/view?filename=<hash>`, the same
 * way image previews are. Without a hash (or off Cloud) this falls back to
 * {@link getAssetFileUrl} with an inline disposition.
 *
 * @param asset The asset whose file should be played
 * @returns The URL to set as the media element's `src`
 */
export function getAssetInlineMediaUrl(asset: AssetItem): string {
  if (isCloud && asset.hash) {
    const params = new URLSearchParams({
      filename: asset.hash,
      type: getAssetType(asset)
    })
    return api.apiURL(`/view?${params}`)
  }
  return getAssetFileUrl(asset, { disposition: 'inline' })
}

/**
 * Prepares a server-supplied media URL (e.g. `thumbnail_url`/`preview_url`)
 * for an `<img>`, `<video>` or `<audio>` `src`, which sends cookies but no
 * headers.
 *
 * Root-relative media routes go through `api.apiURL` so a web session names
 * its workspace on them, as do absolute URLs on this page's own origin. Any
 * other URL is returned as is: other-origin and signed external URLs, `blob:`
 * and `data:` URLs, protocol-relative URLs and non-media routes.
 *
 * @param url The URL the server supplied, if any
 * @returns The URL to load, or an empty string when there is none
 */
export function resolveMediaSrc(url: string | undefined): string {
  if (!url) return ''
  if (url.startsWith('//')) return url
  if (url.startsWith('/')) return isMediaRoute(url) ? api.apiURL(url) : url
  return scopeSameOriginMediaUrl(url)
}

function scopeSameOriginMediaUrl(url: string): string {
  const requests = webSessionRequests()
  if (!requests || !/^https?:\/\//i.test(url)) return url
  try {
    const parsed = new URL(url)
    if (parsed.origin !== window.location.origin) return url
    const route = `${parsed.pathname}${parsed.search}${parsed.hash}`
    const scoped = scopeMediaRoute(route, requests.workspaceId())
    return scoped === route ? url : `${parsed.origin}${scoped}`
  } catch {
    return url
  }
}
