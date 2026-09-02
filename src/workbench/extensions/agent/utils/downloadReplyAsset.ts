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
  const candidate = new URL(asset.url, window.location.origin)
  const apiBase = new URL(api.apiURL(''), window.location.origin)
  const viewPath = `${apiBase.pathname.replace(/\/$/, '')}/view`
  const trusted =
    candidate.origin === apiBase.origin && candidate.pathname === viewPath
  const response = trusted
    ? await api.fetchApi(
        `${candidate.pathname.slice(apiBase.pathname.length)}${candidate.search}`
      )
    : await fetch(asset.url)
  if (!response.ok) return
  downloadBlob(await displayFilename(asset), await response.blob())
}
