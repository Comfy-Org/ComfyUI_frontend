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

const CATALOG_MEDIA_PATH =
  /^\/(?:catalog-media\/[\w-]+\/[\w-]+|preview-media\/\d+\/[\w-]+\/[\w-]+)$/

/** Whether `value` is a same-origin catalog media path, such as an example's reference file. */
export function isCatalogMediaPath(value: string): boolean {
  return CATALOG_MEDIA_PATH.test(value)
}

/** Same-origin catalog paths need the visitor's session; every other source is fetched anonymously. */
export function exampleMediaCredentials(source: string): RequestCredentials {
  return isCatalogMediaPath(source) ? 'same-origin' : 'omit'
}

export function workshopExampleFile(
  source: string,
  fallbackType = 'application/octet-stream'
): FileValue | undefined {
  const catalogPath = isCatalogMediaPath(source)
  if (!catalogPath && !isHttpImageSource(source)) return
  const path = catalogPath ? source : new URL(source).pathname
  const name = path.split('/').at(-1) || 'example'
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
