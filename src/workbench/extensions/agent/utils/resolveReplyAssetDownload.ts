import type { FetchedAssetDownload } from '@/platform/assets/composables/useAssetDownload'
import {
  findOutputAsset,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'
import { api } from '@/scripts/api'

import type { ReplyAsset } from './replyAssets'

async function displayFilename(asset: ReplyAsset): Promise<string> {
  if (!isAssetPreviewSupported()) return asset.filename
  const record = await findOutputAsset(asset.filename).catch(() => undefined)
  const name = record?.name.split('/').pop()
  if (!name) return asset.filename
  const dot = asset.filename.lastIndexOf('.')
  return name.includes('.') || dot === -1
    ? name
    : `${name}${asset.filename.slice(dot)}`
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
