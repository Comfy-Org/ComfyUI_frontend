import { assetService } from '@/platform/assets/services/assetService'
import { api } from '@/scripts/api'

interface AssetRecord {
  id: string
  name: string
  asset_hash?: string
  preview_url?: string
  preview_id?: string | null
}

export function isAssetPreviewSupported(): boolean {
  return (
    assetService.isAssetAPIEnabled() || api.getServerFeature('assets', false)
  )
}

async function fetchAssets(
  params: Record<string, string>
): Promise<AssetRecord[]> {
  const query = new URLSearchParams(params)
  const res = await api.fetchApi(`/assets?${query}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.assets ?? []
}

function resolvePreviewUrl(asset: AssetRecord): string {
  if (asset.preview_url) return api.apiURL(asset.preview_url)

  const contentId = asset.preview_id ?? asset.id
  return api.apiURL(`/assets/${contentId}/content`)
}

/**
 * Find an output asset record by content hash, falling back to name.
 * On cloud, output filenames are content-hashed; use asset_hash to match.
 * On local, filenames are not hashed; use name_contains to match.
 */
export async function findOutputAsset(
  name: string
): Promise<AssetRecord | undefined> {
  const byHash = await fetchAssets({ asset_hash: name })
  const hashMatch = byHash.find((a) => a.asset_hash === name)
  if (hashMatch) return hashMatch

  const byName = await fetchAssets({ name_contains: name })
  return byName.find((a) => a.name === name)
}

export async function findServerPreviewUrl(
  name: string
): Promise<string | null> {
  try {
    const asset = await findOutputAsset(name)
    if (!asset?.preview_id) return null

    return resolvePreviewUrl(asset)
  } catch {
    return null
  }
}

export async function persistThumbnail(
  name: string,
  blob: Blob
): Promise<void> {
  try {
    const asset = await findOutputAsset(name)
    if (!asset || asset.preview_id) return

    const previewFilename = `${asset.name}_preview.png`
    const uploaded = await assetService.uploadAssetFromBase64({
      data: await blobToDataUrl(blob),
      name: previewFilename,
      tags: ['output'],
      user_metadata: { filename: previewFilename }
    })

    await assetService.updateAsset(asset.id, {
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
