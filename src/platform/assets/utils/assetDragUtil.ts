/**
 * The drag half of the application-wide asset drag/drop contract.
 *
 * Every surface that lets a user drag an asset out of the assets panel writes
 * the same two flavours, so the drop side stays view-agnostic: the agent
 * composer accepts a drop by looking for {@link MIME_ASSET_INFO} in
 * `dataTransfer.types` alone, and the canvas loads the file from `text/uri-list`.
 * Keeping this in one place is what stops a view mode from silently shipping a
 * row that starts a drag carrying nothing.
 */
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { api } from '@/scripts/api'

import {
  getAssetType,
  isGeneratedTempOutput
} from '@/platform/assets/composables/media/assetMappers'
import { getOutputAssetMetadata } from '@/platform/assets/schemas/assetMetadataSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { getAssetUrlFilename, getOutputSubfolder } from './assetMetadataUtils'
import { resolvePreviewUrl } from './assetPreviewUtil'
import { getAssetFileUrl } from './assetUrlUtil'
import { parseUrl } from '@/utils/urlSafety'

function resolveThumbnailUrl(url: string): URL | null {
  const source = parseUrl(url) || url.startsWith('//') ? url : api.apiURL(url)
  return parseUrl(source, location.href)
}

function assetMediaSources(asset: AssetItem) {
  const mediaKind = getMediaTypeFromFilename(asset.name)
  const previewUrl = parseUrl(resolvePreviewUrl(asset), location.href)
  const playable = mediaKind === 'video' || mediaKind === 'audio'
  const mediaUrl = playable
    ? parseUrl(getAssetFileUrl(asset, { disposition: 'inline' }), location.href)
    : undefined
  const posterUrl = asset.preview_id
    ? previewUrl
    : asset.thumbnail_url && asset.thumbnail_url !== asset.preview_url
      ? resolveThumbnailUrl(asset.thumbnail_url)
      : undefined
  return {
    media_kind: mediaKind,
    preview_url:
      mediaKind === 'image'
        ? previewUrl?.toString()
        : mediaKind === 'video'
          ? posterUrl?.toString()
          : undefined,
    media_url: mediaUrl?.toString()
  }
}

/**
 * Start a native drag carrying `asset`.
 *
 * Ctrl/Meta cancels the drag rather than carrying the asset: those modifiers
 * belong to panel selection (marquee, range select), and a native drag would
 * swallow the gesture.
 *
 * @param event The `dragstart` event from the dragged row or card
 * @param asset The asset that row or card renders, if it has one yet
 */
export function startAssetDrag(
  event: DragEvent,
  asset: AssetItem | undefined
): void {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    return
  }

  if (!asset) return

  const { dataTransfer } = event
  if (!dataTransfer) return

  const output = getOutputAssetMetadata(asset.user_metadata)?.allOutputs?.[0]
  const assetInfo = {
    ...(output?.filename
      ? {
          filename: output.filename,
          subfolder: output.subfolder,
          type: output.type,
          display_name: output.display_name
        }
      : {
          filename: asset.name,
          subfolder: getOutputSubfolder(asset.user_metadata),
          type: isGeneratedTempOutput(asset)
            ? 'temp'
            : getAssetType(asset.tags),
          display_name: asset.display_name ?? undefined
        }),
    attachment_ref: getAssetUrlFilename(asset),
    ...assetMediaSources(asset)
  }
  dataTransfer.setData(MIME_ASSET_INFO, JSON.stringify(assetInfo))

  const fileUrl = parseUrl(getAssetFileUrl(asset), location.href)
  if (!fileUrl) return

  dataTransfer.setData('text/uri-list', fileUrl.toString())
}
