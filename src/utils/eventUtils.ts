import { getExtension } from '@/utils/mimeTypeUtil'

function extractFilenameFromUri(uri: string, mimeType: string): string {
  try {
    const pathname = new URL(uri).pathname
    const basename = pathname.split('/').pop()
    if (basename && basename.includes('.')) return basename
  } catch {
    // Not a valid URL, fall through
  }

  return `downloaded${getExtension(mimeType)}`
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
    const filename = extractFilenameFromUri(uri, blob.type)
    return [new File([blob], filename, { type: blob.type })]
  } catch {
    return []
  }
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
