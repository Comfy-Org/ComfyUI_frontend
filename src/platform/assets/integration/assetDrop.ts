import { z } from 'zod'

import { zResultItem } from '@comfyorg/api-client/executionTypes'
import type { MediaKind } from '@comfyorg/assets-core/media'
import { zMediaKindSchema } from '@comfyorg/assets-core/media'
import { MIME_ASSET_INFO } from '@/platform/assets/constants/assetDrag'
import type { DroppedFile } from '@/utils/eventUtils'
import {
  fetchDroppedFile,
  getDroppedFiles,
  getDroppedUri
} from '@/utils/eventUtils'

const zDraggedAssetInfo = zResultItem.and(
  z.object({
    attachment_ref: z.string().min(1).optional(),
    media_kind: zMediaKindSchema.optional(),
    preview_url: z.url().optional(),
    media_url: z.url().optional()
  })
)

export function parseAssetInfo(dataTransfer: DataTransfer) {
  const assetString = dataTransfer.getData(MIME_ASSET_INFO)
  try {
    return zDraggedAssetInfo.safeParse(JSON.parse(assetString)).data
  } catch {
    return undefined
  }
}

export interface DroppedAsset extends DroppedFile {
  kind?: MediaKind
  previewUrl?: string
  mediaUrl?: string
}

export function getDroppedAsset(
  dataTransfer: DataTransfer
): DroppedAsset | undefined {
  const asset = parseAssetInfo(dataTransfer)
  const name = asset?.display_name ?? asset?.filename
  const uri = getDroppedUri(dataTransfer)
  const ref = asset?.attachment_ref
  const fallbackName = ref ?? uri
  if (!fallbackName) return undefined

  return {
    name: name ?? fallbackName,
    uri,
    ref,
    kind: asset?.media_kind,
    previewUrl: asset?.preview_url,
    mediaUrl: asset?.media_url
  }
}

export async function extractFilesFromDragEvent(
  event: DragEvent
): Promise<File[]> {
  if (!event.dataTransfer) return []

  const files = getDroppedFiles(event.dataTransfer)
  if (files.length > 0) return files

  const asset = getDroppedAsset(event.dataTransfer)
  if (!asset) return []

  const file = await fetchDroppedFile(asset)
  return file ? [file] : []
}
