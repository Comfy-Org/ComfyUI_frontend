import {
  findOutputAsset,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'
import { api } from '@/scripts/api'

import type { FetchedAssetDownload } from '@/platform/assets/composables/useAssetDownload'
import type { ReplyAsset } from './replyAssets'

function preserveExtension(name: string, filename: string): string {
  const dot = filename.lastIndexOf('.')
  return name.includes('.') || dot === -1
    ? name
    : `${name}${filename.slice(dot)}`
}

async function displayFilename(asset: ReplyAsset): Promise<string> {
  const fallback = preserveExtension(
    asset.label ?? asset.filename,
    asset.filename
  )
  if (!isAssetPreviewSupported()) return fallback
  const record = await findOutputAsset(asset.filename).catch(() => undefined)
  const name = record?.name.split('/').pop()
  return name ? preserveExtension(name, asset.filename) : fallback
}

/**
 * Reply asset URLs are model-influenced, so only the exact same-origin
 * `/api/view` route is allowed to carry the caller's credentials. Every other
 * URL is fetched credentialless: `credentials: 'omit'` stays in force across
 * redirects, so signed CDN downloads keep working without origin cookies.
 */
export async function resolveReplyAssetDownload(
  asset: ReplyAsset
): Promise<FetchedAssetDownload> {
  const candidate = new URL(asset.url, window.location.origin)
  const apiBase = new URL(api.apiURL(''), window.location.origin)
  const viewPath = `${apiBase.pathname.replace(/\/$/, '')}/view`
  const trusted =
    candidate.origin === apiBase.origin && candidate.pathname === viewPath
  return {
    url: trusted
      ? `${candidate.pathname.slice(apiBase.pathname.length)}${candidate.search}`
      : asset.url,
    filename: await displayFilename(asset),
    fetch: trusted
      ? (url: string) => api.fetchApi(url)
      : (url: string) => fetch(url, { credentials: 'omit' }),
    mode: 'fetch',
    preferResponseFilename: false
  }
}
