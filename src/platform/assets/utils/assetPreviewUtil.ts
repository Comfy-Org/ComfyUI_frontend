import { assetService } from '@/platform/assets/services/assetService'
import { api } from '@/scripts/api'

interface AssetRecord {
  id: string
  name: string
  asset_hash?: string
  preview_url?: string
  preview_id?: string
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

/**
 * Find the model asset record.
 * Tries name_contains first (works on local where filenames aren't hashed).
 * Falls back to job_ids filter (works on cloud where output filenames are
 * content-hashed but the asset record retains the original name + job ID).
 */
async function findModelAsset(
  name: string,
  jobId?: string | null
): Promise<AssetRecord | undefined> {
  const byName = await fetchAssets({ name_contains: name })
  const modelAsset = byName.find((a) => a.name === name)
  if (modelAsset) return modelAsset

  if (jobId) {
    const byJob = await fetchAssets({ job_ids: jobId })
    return byJob.find((a) => a.asset_hash === name)
  }

  return undefined
}

export async function findServerPreviewUrl(
  name: string,
  jobId?: string | null
): Promise<string | null> {
  try {
    const modelAsset = await findModelAsset(name, jobId)

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
  jobId?: string | null
): Promise<void> {
  try {
    const modelAsset = await findModelAsset(modelName, jobId)
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
