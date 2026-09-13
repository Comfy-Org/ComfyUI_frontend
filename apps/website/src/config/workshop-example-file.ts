import type { FileValue } from './workshop-playground'
import { isHttpImageSource } from './workshop-image-source'

export const WORKSHOP_EXAMPLE_MIME_TYPES = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm'],
  ['mov', 'video/quicktime'],
  ['mp3', 'audio/mpeg'],
  ['wav', 'audio/wav'],
  ['m4a', 'audio/mp4']
])

export function workshopExampleFile(
  source: string,
  fallbackType = 'application/octet-stream'
): FileValue | undefined {
  if (!isHttpImageSource(source)) return
  const name = new URL(source).pathname.split('/').at(-1) || 'example'
  const type =
    WORKSHOP_EXAMPLE_MIME_TYPES.get(
      name.split('.').at(-1)?.toLowerCase() ?? ''
    ) ?? fallbackType
  return { name, type, size: 0, previewUrl: source, sourceUrl: source }
}

export function workshopExampleFiles(
  source: string | readonly string[],
  multiple = false,
  fallbackType?: string
): FileValue | FileValue[] | undefined {
  const urls = typeof source === 'string' ? [source] : source
  const result: FileValue[] = []
  for (const url of urls) {
    const file = workshopExampleFile(url, fallbackType)
    if (!file) return
    result.push(file)
  }
  if (!result.length || (!multiple && result.length > 1)) return
  return multiple ? result : result[0]
}
