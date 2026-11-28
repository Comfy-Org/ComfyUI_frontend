import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

export const URI_DROP_TYPES = ['text/uri-list', 'text/x-moz-url']
const handledDropEvents = new WeakSet<DragEvent>()

const fallbackMediaExtensions = {
  image: new Set(['heic', 'heif', 'jxl', 'exr', 'hdr']),
  audio: new Set(['aac', 'm4a', 'opus']),
  video: new Set(['flv', 'm4v', 'mkv', 'wmv'])
} as const

export interface DroppedFile {
  name: string
  uri?: string
  ref?: string
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

export function getDroppedUri(dataTransfer: DataTransfer): string | undefined {
  const match = [...dataTransfer.types].find((type) =>
    URI_DROP_TYPES.includes(type)
  )
  return match && dataTransfer.getData(match).split('\n')[0]
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
  { name, ref }: DroppedFile,
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

interface FetchDroppedFileOptions {
  signal?: AbortSignal
  nameFromSource?: boolean
}

export async function fetchDroppedFile(
  asset: DroppedFile,
  { signal, nameFromSource = false }: FetchDroppedFileOptions = {}
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

export function getDroppedFiles(dataTransfer: DataTransfer): File[] {
  const itemFiles = getFilesFromItems(dataTransfer.items).filter(
    (file) => !isSyntheticImageBmpPlaceholder(file)
  )
  if (itemFiles.length > 0) return itemFiles.map(withHdrImageType)

  return Array.from(dataTransfer.files)
    .filter((file) => !isSyntheticImageBmpPlaceholder(file))
    .map(withHdrImageType)
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
