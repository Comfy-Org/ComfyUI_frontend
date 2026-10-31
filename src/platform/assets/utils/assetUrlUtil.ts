/**
 * Utilities for constructing asset URLs
 */

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  isMediaRoute,
  scopeMediaRoute
} from '@comfyorg/api-client/sessionMediaUrl'
import { webSessionRequests } from '@comfyorg/api-client/webSessionFetch'
import { isCloud } from '@/platform/distribution/types'
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
