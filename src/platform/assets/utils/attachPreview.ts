import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'

export async function attachPreview(
  asset: { id: string; name: string },
  blob: Blob
): Promise<void> {
  const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png'
  const previewFilename = `${asset.name}_preview.${extension}`
  const uploaded = await assetService.uploadAssetFromBase64({
    data: await blobToDataUrl(blob),
    name: previewFilename,
    tags: [isCloud ? 'preview' : 'output'],
    user_metadata: { filename: previewFilename }
  })

  await assetService.updateAsset(asset.id, {
    preview_id: uploaded.id
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
