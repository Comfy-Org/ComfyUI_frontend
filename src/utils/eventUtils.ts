import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'

export interface DroppedAsset {
  name: string
  uri?: string
  ref?: string
  kind?: MediaKind
  previewUrl?: string
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
  { name, uri, ref }: DroppedAsset,
  signal?: AbortSignal
): Promise<File | undefined> {
  if (!uri) return undefined
  try {
    const response = await fetch(uri, { signal })
    if (!response.ok) return undefined
    const blob = await response.blob()
    // Each candidate is taken only if it carries an extension. `ref` outranks
    // the storage basename because /api/assets/<id>/content 302s to a signed
    // URL keyed by hash: that basename is either extensionless (yielding a File
    // the accept list then refuses) or a dotted digest like `<hex>.png`, which
    // passes the extension test and relabels the chip — and, since this File's
    // name is what uploadImage posts, becomes the uploaded ref and the name the
    // seed shows the model.
    const resolvedUrl = new URL(response.url || uri, 'http://localhost')
    const named = [
      resolvedUrl.searchParams.get('filename'),
      ref,
      decodeURIComponent(resolvedUrl.pathname.split('/').pop() || ''),
      name
    ].find((candidate) => candidate && /\.[a-z0-9]{1,8}$/i.test(candidate))
    return new File([blob], named || name, { type: blob.type })
  } catch {
    return undefined
  }
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

  const file = await fetchDroppedAsset(asset)
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
