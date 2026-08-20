import { downloadBlob } from '@/base/common/downloadUtil'
import { api } from '@/scripts/api'

import type { ReplyAsset } from './replyAssets'

export async function downloadReplyAsset(asset: ReplyAsset): Promise<void> {
  const apiBase = api.apiURL('/')
  const route = asset.url.includes(apiBase)
    ? asset.url.slice(asset.url.indexOf(apiBase) + api.apiURL('').length)
    : asset.url
  const response = await api.fetchApi(route)
  if (!response.ok) return
  downloadBlob(asset.filename, await response.blob())
}
