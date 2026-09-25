import { z } from 'zod'

export const ASSET_LIMITS = {
  count: 40,
  bytes: 128 * 1024 * 1024,
  fileBytes: 12 * 1024 * 1024,
  pixels: 32 * 1024 * 1024
}
export const ASSET_KINDS = ['character', 'location', 'prop'] as const
export const ASSET_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp'
] as const
const assetSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(ASSET_KINDS),
  notes: z.string().trim().max(500),
  blob: z.custom<Blob>(
    (value) =>
      value instanceof Blob &&
      value.size > 0 &&
      value.size <= ASSET_LIMITS.fileBytes &&
      ASSET_IMAGE_TYPES.some((type) => type === value.type)
  )
})
export type SavedAsset = z.infer<typeof assetSchema>
type AssetKind = SavedAsset['kind']
export interface AssetReference {
  readonly id: string
  readonly name: string
  readonly kind: AssetKind
  readonly notes: string
  readonly file: File
}

export function validateAsset(input: unknown): SavedAsset {
  return assetSchema.parse(input)
}

function access<T>(
  namespace: string,
  mode: IDBTransactionMode,
  action: (
    store: IDBObjectStore,
    done: (value: T) => void,
    fail: (error: unknown) => void
  ) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!namespace.trim() || namespace.length > 500) {
      reject(new Error('Missing asset namespace'))
      return
    }
    let database: IDBDatabase | undefined
    let transaction: IDBTransaction | undefined
    let result: T
    let settled = false
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      database?.close()
      if (error) reject(error)
      else resolve(result)
    }
    const fail = (error: unknown) => {
      transaction?.abort()
      finish(error)
    }
    const timeout = setTimeout(
      () => fail(new DOMException('Asset storage timed out', 'TimeoutError')),
      10000
    )
    try {
      const opening = indexedDB.open('comfy-cinema-assets', 1)
      opening.onupgradeneeded = () =>
        opening.result
          .createObjectStore('assets')
          .createIndex('namespace', 'namespace')
      opening.onerror = () => finish(opening.error)
      opening.onblocked = () => finish(new Error('Asset storage blocked'))
      opening.onsuccess = () => {
        database = opening.result
        if (settled) {
          database.close()
          return
        }
        database.onversionchange = () => database?.close()
        try {
          transaction = database.transaction('assets', mode)
          transaction.oncomplete = () => finish()
          transaction.onabort = () =>
            finish(transaction?.error ?? new Error('Asset storage aborted'))
          transaction.onerror = () =>
            finish(transaction?.error ?? new Error('Asset storage failed'))
          action(
            transaction.objectStore('assets'),
            (value) => {
              result = value
            },
            fail
          )
        } catch (error) {
          fail(error)
        }
      }
    } catch (error) {
      finish(error)
    }
  })
}

export function listAssets(namespace: string): Promise<SavedAsset[]> {
  return access(namespace, 'readonly', (store, done, fail) => {
    const request = store.index('namespace').getAll(namespace)
    request.onsuccess = () => {
      try {
        done(
          z
            .array(assetSchema)
            .parse(request.result)
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      } catch (error) {
        fail(error)
      }
    }
  })
}

export async function saveAsset(
  namespace: string,
  input: SavedAsset
): Promise<SavedAsset> {
  const asset = validateAsset(input)
  return access(namespace, 'readwrite', (store, done, fail) => {
    const request = store.index('namespace').getAll(namespace)
    request.onsuccess = () => {
      try {
        const others = z
          .array(assetSchema)
          .parse(request.result)
          .filter((item) => item.id !== asset.id)
        if (
          others.length >= ASSET_LIMITS.count ||
          others.reduce((sum, item) => sum + item.blob.size, asset.blob.size) >
            ASSET_LIMITS.bytes
        )
          throw new DOMException(
            'Asset library limit reached',
            'QuotaExceededError'
          )
        store.put({ ...asset, namespace }, [namespace, asset.id])
        done(asset)
      } catch (error) {
        fail(error)
      }
    }
  })
}

export function deleteAsset(namespace: string, id: string): Promise<void> {
  return access(namespace, 'readwrite', (store, done) => {
    store.delete([namespace, id])
    done()
  })
}

export function assetFile(asset: SavedAsset): File {
  const value = validateAsset(asset)
  const name = Array.from(value.name, (character) =>
    character.charCodeAt(0) < 32 ? '_' : character
  )
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
  const extension =
    value.blob.type === 'image/jpeg'
      ? 'jpg'
      : value.blob.type === 'image/webp'
        ? 'webp'
        : 'png'
  return new File([value.blob], `${name}.${extension}`, {
    type: value.blob.type
  })
}

export interface AssetCrop {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export function cropBounds(
  crop: AssetCrop,
  width: number,
  height: number
): AssetCrop {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > ASSET_LIMITS.pixels
  )
    throw new Error('Invalid image dimensions')
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite))
    throw new Error('Invalid crop')
  const x = Math.min(width - 1, Math.max(0, Math.round(crop.x)))
  const y = Math.min(height - 1, Math.max(0, Math.round(crop.y)))
  return {
    x,
    y,
    width: Math.min(width - x, Math.max(1, Math.round(crop.width))),
    height: Math.min(height - y, Math.max(1, Math.round(crop.height)))
  }
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  validateAsset({ id: 'decode', name: 'Image', kind: 'prop', notes: '', blob })
  const bitmap = await createImageBitmap(blob)
  if (
    !bitmap.width ||
    !bitmap.height ||
    bitmap.width * bitmap.height > ASSET_LIMITS.pixels
  ) {
    bitmap.close()
    throw new Error('Image dimensions exceed limit')
  }
  return bitmap
}

export async function imageDimensions(
  blob: Blob
): Promise<{ width: number; height: number }> {
  const bitmap = await decode(blob)
  try {
    return { width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

export async function cropAssetImage(
  blob: Blob,
  input: AssetCrop
): Promise<File> {
  const bitmap = await decode(blob)
  try {
    const crop = cropBounds(input, bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = crop.width
    canvas.height = crop.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image crop unavailable')
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    )
    const result = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error('Image crop failed')),
        'image/png'
      )
    )
    validateAsset({
      id: 'crop',
      name: 'Crop',
      kind: 'prop',
      notes: '',
      blob: result
    })
    return new File([result], 'reference-crop.png', { type: 'image/png' })
  } finally {
    bitmap.close()
  }
}
