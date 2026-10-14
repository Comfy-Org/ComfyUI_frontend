import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

export interface DroppedAsset {
  name: string
  uri?: string
  ref?: string
  kind?: MediaKind
  previewUrl?: string
  mediaUrl?: string
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
        previewUrl: asset?.preview_url,
        mediaUrl: asset?.media_url
      }
    : undefined
}

/**
 * Last path segment, percent-decoded when it can be.
 *
 * `decodeURIComponent` throws on a malformed escape like `%E0%A4%A`, and this
 * runs inside the fetch's try block — so one bad byte in a URL discarded a
 * blob that had already downloaded fine and reported it to the user as a
 * failed retrieval. The raw segment is a worse name, not a reason to drop the
 * file.
 */
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
  // Each candidate is taken only if it carries an extension. `ref` outranks
  // the storage basename because /api/assets/<id>/content 302s to a signed
  // URL keyed by hash: that basename is either extensionless (yielding a File
  // the accept list then refuses) or a dotted digest like `<hex>.png`, which
  // passes the extension test and relabels the chip — and, since this File's
  // name is what uploadImage posts, becomes the uploaded ref and the name the
  // seed shows the model.
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
  /** Name the File from the stored filename instead of the display label. */
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

  // Dragging from Chrome->Firefox there is a file but its a bmp, so ignore that
  const files = Array.from(event.dataTransfer.files)
    .filter((file) => file.type !== 'image/bmp')
    .map(withHdrImageType)

  if (files.length > 0) return files

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
