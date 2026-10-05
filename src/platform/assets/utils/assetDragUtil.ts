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

import { getAssetType } from '../composables/media/assetMappers'
import { getOutputAssetMetadata } from '../schemas/assetMetadataSchema'
import type { AssetItem } from '../schemas/assetSchema'
import { MIME_ASSET_INFO } from '../schemas/mediaAssetSchema'
import { getAssetUrlFilename } from './assetMetadataUtils'
import { resolvePreviewUrl } from './assetPreviewUtil'
import { getAssetFileUrl } from './assetUrlUtil'

function assetMediaSources(asset: AssetItem) {
  const mediaKind = getMediaTypeFromFilename(asset.name)
  const previewUrl = URL.parse(resolvePreviewUrl(asset), location.href)
  const playable = mediaKind === 'video' || mediaKind === 'audio'
  const mediaUrl = playable
    ? URL.parse(
        getAssetFileUrl(asset, { disposition: 'inline' }),
        location.href
      )
    : undefined
  const posterUrl = asset.preview_id
    ? previewUrl
    : asset.thumbnail_url && asset.thumbnail_url !== asset.preview_url
      ? URL.parse(api.apiURL(asset.thumbnail_url), location.href)
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
          type: getAssetType(asset.tags),
          display_name: asset.display_name ?? undefined
        }),
    attachment_ref: getAssetUrlFilename(asset),
    ...assetMediaSources(asset)
  }
  dataTransfer.setData(MIME_ASSET_INFO, JSON.stringify(assetInfo))

  const fileUrl = URL.parse(getAssetFileUrl(asset), location.href)
  if (!fileUrl) return

  dataTransfer.setData('text/uri-list', fileUrl.toString())
}
