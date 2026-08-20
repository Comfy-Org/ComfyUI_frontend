import { downloadBlob } from '@/base/common/downloadUtil'
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

export async function downloadReplyAsset(asset: ReplyAsset): Promise<void> {
  const apiBase = api.apiURL('/')
  const route = asset.url.includes(apiBase)
    ? asset.url.slice(asset.url.indexOf(apiBase) + api.apiURL('').length)
    : asset.url
  const response = await api.fetchApi(route)
  if (!response.ok) return
  downloadBlob(await displayFilename(asset), await response.blob())
}
