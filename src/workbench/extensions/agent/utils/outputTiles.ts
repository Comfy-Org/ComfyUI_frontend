import { parseUrl } from '@/utils/urlSafety'
import { omit } from 'es-toolkit'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { getAssetUrlFilename } from '@/platform/assets/utils/assetMetadataUtils'
import { resolvePreviewUrl } from '@/platform/assets/utils/assetPreviewUtil'
import {
  getAssetFileUrl,
  getAssetSubfolder
} from '@/platform/assets/utils/assetUrlUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import type { MediaType } from '@/utils/formatUtil'
import type { AugmentedResultItem } from '@/utils/resultItem'

import type { ComposerAttachment } from '@/workbench/extensions/agent/types/composerAttachment'

export function outputTileKey(asset: AssetItem): string {
  return asset.id
}

export function outputTileKind(asset: AssetItem): MediaType {
  return getMediaTypeFromFilename(asset.name)
}

export function outputAttachment(
  asset: AssetItem
): ComposerAttachment | undefined {
  const ref = getAssetUrlFilename(asset)
  const kind = outputTileKind(asset)
  if (!ref || kind === 'other') return undefined

  return {
    id: `asset:${ref}`,
    name: asset.display_name || asset.name,
    ref,
    previewUrl:
      kind === 'image'
        ? parseUrl(resolvePreviewUrl(asset), location.href)?.toString()
        : undefined
  }
}

export function asFileSelection(asset: AssetItem): AssetItem {
  return {
    ...asset,
    user_metadata:
      asset.user_metadata &&
      omit(asset.user_metadata, ['outputCount', 'allOutputs'])
  }
}

export function outputGalleryItem(asset: AssetItem): AugmentedResultItem {
  const kind = outputTileKind(asset)
  return {
    filename: asset.name,
    subfolder: getAssetSubfolder(asset),
    type: 'output',
    nodeId: '',
    mediaType: kind === 'image' ? 'images' : kind,
    mediaTypeIsResolved: true,
    url: getAssetFileUrl(asset, { disposition: 'inline' })
  }
}
