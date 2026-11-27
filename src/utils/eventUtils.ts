import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

export interface DroppedFile {
  name: string
  uri?: string
  ref?: string
}

export function getDroppedUri(dataTransfer: DataTransfer): string | undefined {
  const validTypes = ['text/uri-list', 'text/x-moz-url']
  const match = [...dataTransfer.types].find((type) =>
    validTypes.includes(type)
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
  return Array.from(dataTransfer.files)
    .filter((file) => file.type !== 'image/bmp')
    .map(withHdrImageType)
}

export function withHdrImageType(file: File): File {
  if (file.type || !isHdrImageFilename(file.name)) return file
  const type = file.name.toLowerCase().endsWith('.hdr')
    ? 'image/vnd.radiance'
    : 'image/x-exr'
  return new File([file], file.name, { type, lastModified: file.lastModified })
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
