import { assetService } from '@/platform/assets/services/assetService'
import { api } from '@/scripts/api'

interface AssetRecord {
  id: string
  name: string
  preview_url?: string
  preview_id?: string
}

export function isAssetPreviewSupported(): boolean {
  return (
    assetService.isAssetAPIEnabled() || api.getServerFeature('assets', false)
  )
}

/**
 * Extract the filename portion from a path that may include subdirectories.
 * e.g. "mesh/ComfyUI_00003_.glb" -> "ComfyUI_00003_.glb"
 */
function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(i + 1) : path
}

async function fetchAssetsByName(name: string): Promise<AssetRecord[]> {
  const params = new URLSearchParams({ name_contains: name })
  const res = await api.fetchApi(`/assets?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.assets ?? []
}

/**
 * Search for the model asset record by name.
 * On local, `name` (the raw filename) matches directly.
 * On cloud, `name` is a hash; fall back to `displayName` (original filename)
 * which may include a subfolder prefix.
 */
async function findModelAsset(
  name: string,
  displayName?: string
): Promise<AssetRecord | undefined> {
  let assets = await fetchAssetsByName(name)
  let modelAsset = assets.find((a) => a.name === name)

  if (!modelAsset && displayName) {
    const base = basename(displayName)
    assets = await fetchAssetsByName(base)
    modelAsset =
      assets.find((a) => a.name === base) ??
      assets.find((a) => a.name === displayName)
  }

  return modelAsset
}

export async function findServerPreviewUrl(
  name: string,
  displayName?: string
): Promise<string | null> {
  try {
    const modelAsset = await findModelAsset(name, displayName)

    if (!modelAsset?.preview_id) return null

    // Local API computes preview_url from the linked preview asset
    if (modelAsset.preview_url) return api.api_base + modelAsset.preview_url

    // Cloud list API may omit preview_url; construct from preview_id directly
    return api.apiURL(`/assets/${modelAsset.preview_id}/content`)
  } catch {
    return null
  }
}

export async function persistThumbnail(
  modelName: string,
  blob: Blob,
  displayName?: string
): Promise<void> {
  try {
    const modelAsset = await findModelAsset(modelName, displayName)
    if (!modelAsset || modelAsset.preview_id) return

    const previewFilename = `${modelAsset.name}_preview.png`
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
