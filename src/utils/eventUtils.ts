import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'

export interface DroppedAsset {
  name: string
  uri?: string
  ref?: string
  kind?: MediaKind
  previewUrl?: string
}

class DroppedAssetFetchError extends Error {
  constructor(status: number) {
    super(`Dropped asset fetch failed with HTTP ${status}`)
    this.name = 'DroppedAssetFetchError'
  }
}

export function getDroppedAsset(
  dataTransfer: DataTransfer
): DroppedAsset | undefined {
  const asset = parseAssetInfo(dataTransfer)
  const name = asset?.display_name ?? asset?.filename
  const validTypes = ['text/uri-list', 'text/x-moz-url']
  const match = [...dataTransfer.types].find((type) =>
    validTypes.includes(type)
  )
  const uri = match && dataTransfer.getData(match).split('\n')[0]
  const ref = asset?.attachment_ref

  return uri || ref
    ? {
        name: name ?? ref ?? uri!,
        uri,
        ref,
        kind: asset?.media_kind,
        previewUrl: asset?.preview_url
      }
    : undefined
}

export async function fetchDroppedAsset(
  { name, uri }: DroppedAsset,
  signal?: AbortSignal,
  maxBytes?: number
): Promise<File | undefined> {
  if (!uri) return undefined
  const response = await fetch(uri, { signal })
  if (!response.ok) throw new DroppedAssetFetchError(response.status)
  const contentLength = Number(response.headers.get('Content-Length'))
  if (
    maxBytes !== undefined &&
    Number.isFinite(contentLength) &&
    contentLength > maxBytes
  )
    throw new RangeError(`Dropped asset exceeds ${maxBytes} bytes`)
  const blob = await response.blob()
  return new File([blob], name, { type: blob.type })
}

export async function extractFilesFromDragEvent(
  event: DragEvent
): Promise<File[]> {
  if (!event.dataTransfer) return []

  // Dragging from Chrome->Firefox there is a file but its a bmp, so ignore that
  const files = Array.from(event.dataTransfer.files).filter(
    (file) => file.type !== 'image/bmp'
  )

  if (files.length > 0) return files

  const asset = getDroppedAsset(event.dataTransfer)
  if (!asset) return []

  const file = await fetchDroppedAsset(asset).catch(() => undefined)
  return file ? [file] : []
}

export function hasImageType({ type }: File): boolean {
  return type.startsWith('image')
}

export function hasAudioType({ type }: File): boolean {
  return type.startsWith('audio')
}

export function hasVideoType({ type }: File): boolean {
  return type.startsWith('video')
}

export function isMediaFile(file: File): boolean {
  return hasImageType(file) || hasAudioType(file) || hasVideoType(file)
}
