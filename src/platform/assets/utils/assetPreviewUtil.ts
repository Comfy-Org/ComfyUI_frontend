import { api } from '@/scripts/api'

import { assetService } from '../services/assetService'

interface AssetRecord {
  id: string
  name: string
  preview_url?: string
  preview_id?: string
}

async function fetchAssetsByName(name: string): Promise<AssetRecord[]> {
  const params = new URLSearchParams({ name_contains: name })
  const res = await api.fetchApi(`/assets?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.assets ?? []
}

export async function findServerPreviewUrl(
  name: string
): Promise<string | null> {
  try {
    const assets = await fetchAssetsByName(name)

    const modelAsset = assets.find((a) => a.name === name)
    if (!modelAsset?.preview_id) return null

    const previewAsset = assets.find((a) => a.id === modelAsset.preview_id)
    if (!previewAsset?.preview_url) return null

    return api.api_base + previewAsset.preview_url
  } catch {
    return null
  }
}

export async function persistThumbnail(
  modelName: string,
  blob: Blob
): Promise<void> {
  try {
    const assets = await fetchAssetsByName(modelName)
    const modelAsset = assets.find((a) => a.name === modelName)
    if (!modelAsset || modelAsset.preview_id) return

    const previewFilename = `${modelName}_preview.png`
    const uploaded = await assetService.uploadAssetFromBase64({
      data: await blobToDataUrl(blob),
      name: previewFilename,
      tags: ['output'],
      user_metadata: { filename: previewFilename }
    })

    await assetService.updateAsset(modelAsset.id, {
      preview_id: uploaded.id
    })
  } catch {
    // Non-critical — client still shows the rendered thumbnail
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
