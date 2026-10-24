import {
  findOutputAsset,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'
import { api } from '@/scripts/api'
import { getFilenameDetails, getPathDetails } from '@/utils/formatUtil'

import type { FetchedAssetDownload } from '@/platform/assets/composables/useAssetDownload'
import type { ReplyAsset } from './replyAssets'

function preserveExtension(name: string, filename: string): string {
  const { suffix } = getFilenameDetails(filename)
  return name.includes('.') || suffix === null ? name : `${name}.${suffix}`
}

async function displayFilename(asset: ReplyAsset): Promise<string> {
  const fallback = preserveExtension(
    asset.label ?? asset.filename,
    asset.filename
  )
  if (!isAssetPreviewSupported()) return fallback
  const record = await findOutputAsset(asset.filename).catch(() => undefined)
  const name = record && getPathDetails(record.name).fullFilename
  return name ? preserveExtension(name, asset.filename) : fallback
}

/** Authenticates only the exact same-origin API view route; every other URL is fetched without credentials. */
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
