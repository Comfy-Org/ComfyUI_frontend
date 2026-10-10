import type { MediaKind } from '@/lib/cms/editor'

/** Keeps an inlined file, once encoded, under the 4.5 MB request limit. */
export const MAX_MEDIA_BYTES = 3 * 1024 * 1024

export type MediaFileProblem = 'type' | 'size'

export function mediaKindOf(type: string): MediaKind | undefined {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  return undefined
}

export function mediaFileProblem(file: {
  type: string
  size: number
}): MediaFileProblem | undefined {
  if (!mediaKindOf(file.type)) return 'type'
  if (file.size > MAX_MEDIA_BYTES) return 'size'
  return undefined
}

/**
 * Reads a picked file into a link the draft can hold. Until the site API has
 * file storage, only the demo accepts uploads, and it keeps them inline.
 */
export function readMediaFile(
  file: File
): Promise<{ url: string; kind: MediaKind }> {
  return new Promise((resolve, reject) => {
    const kind = mediaKindOf(file.type)
    if (!kind) return reject(new Error('Unsupported media type'))
    const reader = new FileReader()
    reader.addEventListener('load', () =>
      resolve({ url: String(reader.result), kind })
    )
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}
