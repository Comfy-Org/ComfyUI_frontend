import type {
  DownscaleRequest,
  DownscaleResponse
} from './downscaleImageMessages'

export interface DisplayImage {
  readonly source: string
  readonly url: string
  readonly originalSize?: { readonly width: number; readonly height: number }
}

const POOL_SIZE = Math.min(4, Math.max(1, navigator.hardwareConcurrency >> 1))
const MAX_CACHED_IMAGES = 128

const cache = new Map<string, Promise<DisplayImage>>()
const pending = new Map<number, (response: DownscaleResponse) => void>()
let workers: Worker[] | undefined
let workersFailed = false
let nextId = 0

/** Whether this browser can produce downscaled display copies. */
export function canDownscaleImages(): boolean {
  return (
    typeof Worker === 'function' &&
    typeof createImageBitmap === 'function' &&
    typeof OffscreenCanvas === 'function'
  )
}

function workerPool(): Worker[] {
  workers ??= Array.from({ length: POOL_SIZE }, () => {
    const worker = new Worker(
      new URL('./downscaleImage.worker.ts', import.meta.url),
      { type: 'module' }
    )
    worker.onmessage = (event: MessageEvent<DownscaleResponse>) => {
      pending.get(event.data.id)?.(event.data)
      pending.delete(event.data.id)
    }
    worker.onerror = abandonWorkers
    return worker
  })
  return workers
}

function abandonWorkers() {
  workersFailed = true
  workers?.forEach((worker) => worker.terminate())
  for (const [id, resolve] of pending) resolve({ id, result: undefined })
  pending.clear()
}

function requestDownscale(
  source: string,
  maxEdge: number
): Promise<DownscaleResponse> {
  const id = nextId++
  if (workersFailed) return Promise.resolve({ id, result: undefined })
  const pool = workerPool()
  return new Promise((resolve) => {
    pending.set(id, resolve)
    const request: DownscaleRequest = { id, source, maxEdge }
    pool[id % pool.length].postMessage(request)
  })
}

async function downscale(
  source: string,
  maxEdge: number
): Promise<DisplayImage | undefined> {
  const { result } = await requestDownscale(
    new URL(source, location.href).href,
    maxEdge
  )
  if (!result) return undefined
  const url = result.blob ? URL.createObjectURL(result.blob) : source
  return { source, url, originalSize: result.originalSize }
}

/**
 * Resolves a display copy of `source` no larger than `maxEdge` on its longest
 * side, or `source` itself when it cannot be downscaled.
 */
export async function getDisplayImage(
  source: string,
  maxEdge: number
): Promise<DisplayImage> {
  const original = { source, url: source }
  if (!canDownscaleImages()) return original
  const key = `${maxEdge}:${source}`
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    return cached
  }
  const entry = downscale(source, maxEdge)
    .catch(() => undefined)
    .then((image) => {
      if (image) return image
      cache.delete(key)
      return original
    })
  cache.set(key, entry)
  evictOldest()
  return entry
}

function evictOldest() {
  for (const [key, entry] of cache) {
    if (cache.size <= MAX_CACHED_IMAGES) return
    cache.delete(key)
    void entry.then(({ source, url }) => {
      if (url !== source) URL.revokeObjectURL(url)
    })
  }
}
