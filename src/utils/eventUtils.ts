import { getMediaTypeFromFilename } from '@/utils/formatUtil'

export const URI_DROP_TYPES = ['text/uri-list', 'text/x-moz-url']
const handledDropEvents = new WeakSet<DragEvent>()

const fallbackMediaExtensions = {
  image: new Set(['heic', 'heif', 'jxl']),
  audio: new Set(['aac', 'm4a', 'opus']),
  video: new Set(['flv', 'm4v', 'mkv', 'wmv'])
} as const

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

export async function extractFilesFromDragEvent(
  event: DragEvent
): Promise<File[]> {
  if (!event.dataTransfer) return []

  const itemFiles = getFilesFromItems(event.dataTransfer.items).filter(
    (file) => !isSyntheticImageBmpPlaceholder(file)
  )
  if (itemFiles.length > 0) return itemFiles

  // Chrome to Firefox external drags can include a zero-byte BMP placeholder.
  const files = Array.from(event.dataTransfer.files).filter(
    (file) => !isSyntheticImageBmpPlaceholder(file)
  )

  if (files.length > 0) return files

  // Try loading the first URI in the transfer list
  const match = [...event.dataTransfer.types].find((type) =>
    URI_DROP_TYPES.includes(type)
  )
  if (!match) return []

  const uri = event.dataTransfer.getData(match)?.split('\n')?.[0]
  if (!uri) return []

  try {
    const response = await fetch(uri)
    const blob = await response.blob()
    return [new File([blob], uri, { type: blob.type })]
  } catch {
    return []
  }
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

  const mediaType =
    getMediaTypeFromFilename(name) ?? getFallbackMediaTypeFromFilename(name)
  return mediaType === 'image' || mediaType === 'audio' || mediaType === 'video'
    ? mediaType
    : null
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
