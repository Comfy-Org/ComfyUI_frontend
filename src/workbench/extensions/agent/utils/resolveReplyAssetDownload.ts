import {
  findOutputAsset,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'
import { getApiMediaRoute } from '@/platform/assets/utils/assetUrlUtil'
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

/** Authenticates only media routes on this page's API; every other URL is fetched without credentials. */
export async function resolveReplyAssetDownload(
  asset: ReplyAsset
): Promise<FetchedAssetDownload> {
  const route = getApiMediaRoute(asset.url)
  return {
    url: route ?? asset.url,
    filename: await displayFilename(asset),
    fetch: route
      ? (url: string) => api.fetchApi(url)
      : (url: string) => fetch(url, { credentials: 'omit' }),
    mode: 'fetch',
    preferResponseFilename: false
  }
}
