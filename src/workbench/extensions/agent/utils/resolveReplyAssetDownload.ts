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

export async function resolveReplyAssetDownload(
  asset: ReplyAsset
): Promise<FetchedAssetDownload> {
  const apiBase = api.apiURL('/')
  return {
    url: asset.url.includes(apiBase)
      ? asset.url.slice(asset.url.indexOf(apiBase) + api.apiURL('').length)
      : asset.url,
    filename: await displayFilename(asset),
    fetch: (url: string) => api.fetchApi(url),
    mode: 'fetch',
    preferResponseFilename: false
  }
}
