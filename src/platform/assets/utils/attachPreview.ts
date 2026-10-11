import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'

/**
 * Labels a preview the client uploaded. Core reserves the `preview` tag, so
 * outside cloud the preview is stored as an output and lists filter it out.
 */
export const CLIENT_PREVIEW_TAG = 'fe-preview'

export async function attachPreview(
  asset: { id: string; name: string },
  blob: Blob
): Promise<void> {
  const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png'
  const previewFilename = `${asset.name}_preview.${extension}`
  const uploaded = await assetService.uploadAssetFromBase64({
    data: await blobToDataUrl(blob),
    name: previewFilename,
    tags: isCloud ? ['preview'] : ['output', CLIENT_PREVIEW_TAG],
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
