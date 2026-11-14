import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

export const URI_DROP_TYPES = ['text/uri-list', 'text/x-moz-url']
const handledDropEvents = new WeakSet<DragEvent>()

const fallbackMediaExtensions = {
  image: new Set(['heic', 'heif', 'jxl', 'exr', 'hdr']),
  audio: new Set(['aac', 'm4a', 'opus']),
  video: new Set(['flv', 'm4v', 'mkv', 'wmv'])
} as const

export interface DroppedAsset {
  name: string
  uri?: string
  ref?: string
  kind?: MediaKind
  previewUrl?: string
  mediaUrl?: string
}

export function getFilesFromItems(
  items: DataTransferItemList | undefined
): File[] {
  if (!items) return []
  return Array.from(items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file)
}

export function isSyntheticImageBmpPlaceholder(file: File): boolean {
  return file.type === 'image/bmp' && file.size === 0
}

export function markDropEventHandled(event: DragEvent): void {
  handledDropEvents.add(event)
}

export function isDropEventHandled(event: DragEvent): boolean {
  return handledDropEvents.has(event)
}

export function getDroppedAsset(
  dataTransfer: DataTransfer
): DroppedAsset | undefined {
  const asset = parseAssetInfo(dataTransfer)
  const name = asset?.display_name ?? asset?.filename
  const match = [...dataTransfer.types].find((type) =>
    URI_DROP_TYPES.includes(type)
  )
  const uri = match && dataTransfer.getData(match).split('\n')[0]
  const ref = asset?.attachment_ref

  return uri || ref
    ? {
        name: name ?? ref ?? uri!,
        uri,
        ref,
        kind: asset?.media_kind,
        previewUrl: asset?.preview_url,
        mediaUrl: asset?.media_url
      }
    : undefined
}

function decodedBasename(pathname: string): string {
  const segment = pathname.split('/').pop() || ''
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function sourceFileName(
  { name, ref }: DroppedAsset,
  uri: string,
  responseUrl: string
): string {
  const resolvedUrl = new URL(responseUrl || uri, 'http://localhost')
  const named = [
    resolvedUrl.searchParams.get('filename'),
    ref,
    decodedBasename(resolvedUrl.pathname),
    name
  ].find((candidate) => candidate && /\.[a-z0-9]{1,8}$/i.test(candidate))
  return named || name
}

interface FetchDroppedAssetOptions {
  signal?: AbortSignal
  nameFromSource?: boolean
}

export async function fetchDroppedAsset(
  asset: DroppedAsset,
  { signal, nameFromSource = false }: FetchDroppedAssetOptions = {}
): Promise<File | undefined> {
  const { name, uri } = asset
  if (!uri) return undefined
  try {
    const response = await fetch(uri, { signal })
    if (!response.ok) return undefined
    const blob = await response.blob()
    const fileName = nameFromSource
      ? sourceFileName(asset, uri, response.url)
      : name
    return new File([blob], fileName, { type: blob.type })
  } catch {
    return undefined
  }
}

export async function extractFilesFromDragEvent(
  event: DragEvent
): Promise<File[]> {
  if (!event.dataTransfer) return []

  const itemFiles = getFilesFromItems(event.dataTransfer.items).filter(
    (file) => !isSyntheticImageBmpPlaceholder(file)
  )
  if (itemFiles.length > 0) return itemFiles.map(withHdrImageType)

  const files = Array.from(event.dataTransfer.files).filter(
    (file) => !isSyntheticImageBmpPlaceholder(file)
  )
  if (files.length > 0) return files.map(withHdrImageType)

  const asset = getDroppedAsset(event.dataTransfer)
  if (!asset) return []

  const file = await fetchDroppedAsset(asset)
  return file ? [file] : []
}

export function withHdrImageType(file: File): File {
  if (file.type || !isHdrImageFilename(file.name)) return file
  const type = file.name.toLowerCase().endsWith('.hdr')
    ? 'image/vnd.radiance'
    : 'image/x-exr'
  return new File([file], file.name, { type, lastModified: file.lastModified })
}

type SupportedMediaType = 'image' | 'audio' | 'video'

function getFallbackMediaTypeFromFilename(
  name: string
): SupportedMediaType | null {
  const extension = name.split('.').pop()?.toLowerCase()
  if (!extension) return null

  if (fallbackMediaExtensions.image.has(extension)) return 'image'
  if (fallbackMediaExtensions.audio.has(extension)) return 'audio'
  if (fallbackMediaExtensions.video.has(extension)) return 'video'

  return null
}

function getMediaTypeFromFile({ name, type }: File): SupportedMediaType | null {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('video/')) return 'video'
  if (type) return null

  const mediaType = getMediaTypeFromFilename(name)
  if (mediaType === 'image' || mediaType === 'audio' || mediaType === 'video') {
    return mediaType
  }

  return getFallbackMediaTypeFromFilename(name)
}

export function hasImageType(file: File): boolean {
  return getMediaTypeFromFile(file) === 'image'
}

export function hasAudioType(file: File): boolean {
  return getMediaTypeFromFile(file) === 'audio'
}

export function hasVideoType(file: File): boolean {
  return getMediaTypeFromFile(file) === 'video'
}

export function isMediaFile(file: File): boolean {
  return hasImageType(file) || hasAudioType(file) || hasVideoType(file)
}
