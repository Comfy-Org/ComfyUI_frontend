import { getMediaTypeFromFilename } from '@comfyorg/shared-frontend-utils/formatUtil'

function getFilesFromItems(items: DataTransferItemList | undefined): File[] {
  if (!items) return []
  return Array.from(items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file)
}

export async function extractFilesFromDragEvent(
  event: DragEvent
): Promise<File[]> {
  if (!event.dataTransfer) return []

  const itemFiles = getFilesFromItems(event.dataTransfer.items).filter(
    (file) => file.type !== 'image/bmp'
  )
  if (itemFiles.length > 0) return itemFiles

  // Dragging from Chrome->Firefox there is a file but its a bmp, so ignore that
  const files = Array.from(event.dataTransfer.files).filter(
    (file) => file.type !== 'image/bmp'
  )

  if (files.length > 0) return files

  // Try loading the first URI in the transfer list
  const validTypes = ['text/uri-list', 'text/x-moz-url']
  const match = [...event.dataTransfer.types].find((t) =>
    validTypes.includes(t)
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

function getMediaTypeFromFile({ name, type }: File): SupportedMediaType | null {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('video/')) return 'video'
  if (type) return null

  const mediaType = getMediaTypeFromFilename(name)
  return mediaType === 'image' ||
    mediaType === 'audio' ||
    mediaType === 'video'
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
