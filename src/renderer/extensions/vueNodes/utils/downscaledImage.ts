import type {
  DownscaleRequest,
  DownscaleResponse
} from './downscaleImageMessages'

export type DisplayImage = {
  readonly source: string
} & Partial<NonNullable<DownscaleResponse['result']>>

const POOL_SIZE = Math.min(4, Math.max(1, navigator.hardwareConcurrency >> 1))
const MAX_CACHED_IMAGES = 128

const cache = new Map<string, Promise<DisplayImage>>()
const pending = new Map<number, (result: DownscaleResponse['result']) => void>()
let workers: Worker[] | undefined
let workersFailed = false
let nextId = 0

function canDownscaleImages(): boolean {
  return (
    typeof Worker === 'function' &&
    typeof createImageBitmap === 'function' &&
    typeof OffscreenCanvas === 'function'
  )
}

function workerPool(): Worker[] | undefined {
  if (workers) return workers
  workers = []
  for (let i = 0; i < POOL_SIZE; i++) {
    try {
      const worker = new Worker(
        new URL('./downscaleImage.worker.ts', import.meta.url),
        { type: 'module' }
      )
      workers.push(worker)
      worker.onmessage = (event: MessageEvent<DownscaleResponse>) => {
        pending.get(event.data.id)?.(event.data.result)
        pending.delete(event.data.id)
      }
      worker.onerror = abandonWorkers
    } catch {
      abandonWorkers()
      return undefined
    }
  }
  return workers
}

function abandonWorkers() {
  workersFailed = true
  workers?.forEach((worker) => worker.terminate())
  for (const resolve of pending.values()) resolve(undefined)
  pending.clear()
}

async function requestDownscale(
  source: string,
  maxEdge: number
): Promise<DownscaleResponse['result']> {
  const id = nextId++
  if (workersFailed) return undefined
  const pool = workerPool()
  if (!pool) return undefined
  const request: DownscaleRequest = {
    id,
    source: new URL(source, location.href).href,
    maxEdge
  }
  return new Promise((resolve) => {
    pending.set(id, resolve)
    pool[id % pool.length].postMessage(request)
  })
}

/**
 * Resolves a display copy of `source` no larger than `maxEdge` on its longest
 * side, or `source` itself when it cannot be downscaled.
 */
export async function getDisplayImage(
  source: string,
  maxEdge: number
): Promise<DisplayImage> {
  const original = { source }
  if (!canDownscaleImages() || source.startsWith('blob:')) return original
  const key = `${maxEdge}:${source}`
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    return cached
  }
  const entry = requestDownscale(source, maxEdge)
    .catch(() => undefined)
    .then((result) => {
      if (result) return { source, ...result }
      if (cache.get(key) === entry) cache.delete(key)
      return original
    })
  cache.set(key, entry)
  evictOldest()
  return entry
}

function evictOldest() {
  for (const key of cache.keys()) {
    if (cache.size <= MAX_CACHED_IMAGES) return
    cache.delete(key)
  }
}
