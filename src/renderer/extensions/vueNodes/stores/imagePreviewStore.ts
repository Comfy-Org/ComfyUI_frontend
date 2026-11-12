import { defineStore } from 'pinia'
import { onScopeDispose } from 'vue'

import type {
  DownscaleRequest,
  DownscaleResponse
} from '@/renderer/extensions/vueNodes/utils/downscaleImageMessages'

export type DisplayImage = {
  readonly source: string
} & Partial<NonNullable<DownscaleResponse['result']>>

const MAX_CACHED_IMAGES = 128

export const useImagePreviewStore = defineStore('imagePreview', () => {
  const poolSize = Math.min(4, Math.max(1, navigator.hardwareConcurrency >> 1))
  const cache = new Map<string, Promise<DisplayImage>>()
  const pending = new Map<
    number,
    (result: DownscaleResponse['result']) => void
  >()
  let workers: Worker[] | null | undefined
  let nextId = 0

  function canDownscaleImages(): boolean {
    return (
      typeof Worker === 'function' &&
      typeof createImageBitmap === 'function' &&
      typeof OffscreenCanvas === 'function'
    )
  }

  function workerPool(): Worker[] | undefined {
    if (workers !== undefined) return workers ?? undefined
    workers = []
    for (let i = 0; i < poolSize; i++) {
      try {
        const worker = new Worker(
          new URL('../utils/downscaleImage.worker.ts', import.meta.url),
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
    workers?.forEach((worker) => worker.terminate())
    workers = null
    for (const resolve of pending.values()) resolve(undefined)
    pending.clear()
  }

  async function requestDownscale(
    source: string,
    maxEdge: number
  ): Promise<DownscaleResponse['result']> {
    const id = nextId++
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

  async function getDisplayImage(
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

  onScopeDispose(() => {
    abandonWorkers()
    cache.clear()
  })

  return { getDisplayImage }
})
