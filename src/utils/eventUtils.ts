import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'

export interface DroppedAsset {
  name: string
  filename?: string
  uri?: string
  ref?: string
  kind?: MediaKind
  previewUrl?: string
}

class DroppedAssetFetchError extends Error {
  constructor(status: number) {
    super(`Dropped asset fetch failed with HTTP ${status}`)
    this.name = 'DroppedAssetFetchError'
  }
}

export class DroppedAssetTooLargeError extends RangeError {
  constructor(readonly maxBytes: number) {
    super(`Dropped asset exceeds ${maxBytes} bytes`)
    this.name = 'DroppedAssetTooLargeError'
  }
}

const MAX_DROPPED_ASSET_BYTES = 100 * 1024 * 1024

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
        filename: asset?.filename,
        uri,
        ref,
        kind: asset?.media_kind,
        previewUrl: asset?.preview_url
      }
    : undefined
}

export async function fetchDroppedAsset(
  { name, uri }: DroppedAsset,
  signal?: AbortSignal,
  maxBytes?: number
): Promise<File | undefined> {
  if (!uri) return undefined
  const response = await fetch(uri, { signal })
  if (!response.ok) {
    await cancelResponseBody(response)
    throw new DroppedAssetFetchError(response.status)
  }
  return fileFromResponse(response, name, maxBytes)
}

export async function fetchTrustedDroppedAsset(
  asset: DroppedAsset,
  signal?: AbortSignal,
  maxBytes?: number
): Promise<File | undefined> {
  if (!asset.uri) return undefined
  const url = new URL(asset.uri, window.location.href)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.origin !== window.location.origin ||
    !url.pathname.endsWith('/api/view')
  )
    return undefined
  return fetchDroppedAsset({ ...asset, uri: url.href }, signal, maxBytes)
}

async function fileFromResponse(
  response: Response,
  name: string,
  maxBytes?: number
): Promise<File> {
  const contentLengthHeader = response.headers.get('Content-Length')
  const contentLength =
    contentLengthHeader === null ? undefined : Number(contentLengthHeader)
  if (
    maxBytes !== undefined &&
    contentLength !== undefined &&
    Number.isFinite(contentLength) &&
    contentLength > maxBytes
  ) {
    await cancelResponseBody(response)
    throw new DroppedAssetTooLargeError(maxBytes)
  }

  if (maxBytes === undefined || !response.body) {
    const blob = await response.blob()
    if (maxBytes !== undefined && blob.size > maxBytes)
      throw new DroppedAssetTooLargeError(maxBytes)
    return new File([blob], name, { type: blob.type })
  }

  const reader = response.body.getReader()
  const chunks: ArrayBuffer[] = []
  let bytesRead = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytesRead += value.byteLength
      if (bytesRead > maxBytes) {
        try {
          await reader.cancel()
        } catch {
          // The size-policy error remains authoritative when teardown fails.
        }
        throw new DroppedAssetTooLargeError(maxBytes)
      }
      chunks.push(value.slice().buffer)
    }
  } finally {
    reader.releaseLock()
  }
  const blob = new Blob(chunks, {
    type: response.headers.get('Content-Type') ?? undefined
  })
  return new File([blob], name, { type: blob.type })
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // The response is already being rejected, so cancellation is best effort.
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

  const file = await fetchDroppedAsset(
    asset,
    undefined,
    MAX_DROPPED_ASSET_BYTES
  ).catch(() => undefined)
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
