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
} from '@/platform/assets/adapters/outputAssetMappers'
import type { AssetItem } from '@comfyorg/assets-core/schema'
import type { MediaKind } from '@comfyorg/assets-core/media'
import type { DraggedAssetInfo } from '@/platform/assets/integration/assetDrop'
import { MIME_ASSET_INFO } from '@/platform/assets/constants/assetDrag'
import { getOutputSubfolder } from '@comfyorg/assets-core/metadata'
import { getStoredOutputIdentity } from '@/platform/assets/adapters/outputAssetResolver'
import type { AugmentedResultItem } from '@/utils/resultItem'
import {
  is3DResult,
  isAudioResult,
  isImageResult,
  isVideoResult
} from '@/utils/resultItem'
import { resultItemPreviewUrl, resultItemUrl } from '@/utils/resultItemUrl'
import { getAssetStoredFilename } from './assetStoragePolicy'
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

  const storedHash = asset.hash ?? getStoredOutputIdentity(asset)?.hash
  const assetInfo: DraggedAssetInfo = {
    filename: getAssetStoredFilename(asset, storedHash),
    subfolder: getOutputSubfolder(asset),
    type: isGeneratedTempOutput(asset) ? 'temp' : getAssetType(asset.tags),
    display_name: asset.display_name || asset.name,
    attachment_ref: storedHash ?? asset.name,
    ...assetMediaSources(asset)
  }
  writeAssetDrag(
    dataTransfer,
    assetInfo,
    parseUrl(getAssetFileUrl(asset), location.href)
  )
}

function writeAssetDrag(
  dataTransfer: DataTransfer,
  info: DraggedAssetInfo,
  fileUrl: URL | null
): void {
  dataTransfer.setData(MIME_ASSET_INFO, JSON.stringify(info))
  if (fileUrl) dataTransfer.setData('text/uri-list', fileUrl.toString())
}

function resultItemMediaKind(item: AugmentedResultItem): MediaKind | undefined {
  if (!item.filename) return undefined
  if (isImageResult(item)) return 'image'
  if (isVideoResult(item)) return 'video'
  if (isAudioResult(item)) return 'audio'
  if (is3DResult(item)) return '3D'
  return undefined
}

/** Whether {@link startResultItemDrag} can carry `item`: a stored image, video, audio or 3D file. */
export function isDraggableResultItem(item: AugmentedResultItem): boolean {
  return resultItemMediaKind(item) !== undefined
}

export function startResultItemDrag(
  event: DragEvent,
  item: AugmentedResultItem
): void {
  const { dataTransfer } = event
  const mediaKind = resultItemMediaKind(item)
  const fileUrl = parseUrl(resultItemUrl(item), location.href)
  if (!dataTransfer || !mediaKind || !fileUrl) return

  const playable = mediaKind === 'video' || mediaKind === 'audio'
  writeAssetDrag(
    dataTransfer,
    {
      filename: item.filename,
      subfolder: item.subfolder,
      type: item.type,
      display_name: item.display_name ?? item.filename,
      attachment_ref: item.hash ?? item.filename,
      media_kind: mediaKind,
      preview_url:
        mediaKind === 'image'
          ? parseUrl(resultItemPreviewUrl(item), location.href)?.toString()
          : undefined,
      media_url: playable ? fileUrl.toString() : undefined
    },
    fileUrl
  )
}
