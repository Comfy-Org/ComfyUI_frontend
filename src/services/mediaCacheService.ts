import { shallowRef } from 'vue'

export interface CachedMedia {
  src: string
  blob?: Blob
  objectUrl?: string
  error?: boolean
  isLoading: boolean
  lastAccessed: number
}

export interface MediaCacheOptions {
  maxSize?: number
  maxAge?: number // in milliseconds
  preloadDistance?: number // pixels from viewport
}

class MediaCacheService {
  public cache = shallowRef(new Map<string, CachedMedia>())
  private readonly maxSize: number
  private readonly maxAge: number
  private cleanupInterval: number | null = null

  constructor(options: MediaCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100
    this.maxAge = options.maxAge ?? 30 * 60 * 1000 // 30 minutes

    // Start cleanup interval
    this.startCleanupInterval()
  }

  private startCleanupInterval() {
    // Clean up every 5 minutes
    this.cleanupInterval = window.setInterval(
      () => {
        this.cleanup()
      },
      5 * 60 * 1000
    )
  }

  private cleanup() {
    const now = Date.now()
    const cacheMap = this.cache.value
    const keysToDelete: string[] = []

    // Find expired entries
    for (const [key, entry] of Array.from(cacheMap.entries())) {
      if (now - entry.lastAccessed > this.maxAge) {
        keysToDelete.push(key)
        // Revoke object URL to free memory
        if (entry.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl)
        }
      }
    }

    // Remove expired entries
    if (keysToDelete.length > 0) {
      const newCache = new Map(cacheMap)
      keysToDelete.forEach((key) => newCache.delete(key))
      this.cache.value = newCache
    }

    // If still over size limit, remove oldest entries
    if (cacheMap.size > this.maxSize) {
      const entries = Array.from(cacheMap.entries())
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

      const toRemove = entries.slice(0, cacheMap.size - this.maxSize)
      const newCache = new Map(cacheMap)

      toRemove.forEach(([key, entry]) => {
        if (entry.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl)
        }
        newCache.delete(key)
      })

      this.cache.value = newCache
    }
  }

  async getCachedMedia(src: string): Promise<CachedMedia> {
    const cacheMap = this.cache.value
    let entry = cacheMap.get(src)

    if (entry) {
      // Update last accessed time
      entry.lastAccessed = Date.now()
      return entry
    }

    // Create new entry
    entry = {
      src,
      isLoading: true,
      lastAccessed: Date.now()
    }

    // Update cache with loading entry
    const newCache = new Map(cacheMap)
    newCache.set(src, entry)
    this.cache.value = newCache

    try {
      // Fetch the media
      const response = await fetch(src)
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      // Update entry with successful result
      const updatedEntry: CachedMedia = {
        src,
        blob,
        objectUrl,
        isLoading: false,
        lastAccessed: Date.now()
      }

      const finalCache = new Map(this.cache.value)
      finalCache.set(src, updatedEntry)
      this.cache.value = finalCache

      return updatedEntry
    } catch (error) {
      console.warn('Failed to cache media:', src, error)

      // Update entry with error
      const errorEntry: CachedMedia = {
        src,
        error: true,
        isLoading: false,
        lastAccessed: Date.now()
      }

      const errorCache = new Map(this.cache.value)
      errorCache.set(src, errorEntry)
      this.cache.value = errorCache

      return errorEntry
    }
  }

  getCacheStats() {
    const cacheMap = this.cache.value
    return {
      size: cacheMap.size,
      maxSize: this.maxSize,
      entries: Array.from(cacheMap.keys())
    }
  }

  clearCache() {
    const cacheMap = this.cache.value
    // Revoke all object URLs
    for (const entry of Array.from(cacheMap.values())) {
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl)
      }
    }
    this.cache.value = new Map()
  }

  preloadMedia(urls: string[]) {
    // Preload media in the background without blocking
    urls.forEach((url) => {
      if (!this.cache.value.has(url)) {
        // Don't await - fire and forget
        this.getCachedMedia(url).catch(() => {
          // Ignore preload errors
        })
      }
    })
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clearCache()
  }
}

// Global instance
let mediaCacheInstance: MediaCacheService | null = null

export function useMediaCache(options?: MediaCacheOptions) {
  if (!mediaCacheInstance) {
    mediaCacheInstance = new MediaCacheService(options)
  }

  const getCachedMedia = (src: string) =>
    mediaCacheInstance!.getCachedMedia(src)
  const getCacheStats = () => mediaCacheInstance!.getCacheStats()
  const clearCache = () => mediaCacheInstance!.clearCache()
  const preloadMedia = (urls: string[]) =>
    mediaCacheInstance!.preloadMedia(urls)

  return {
    getCachedMedia,
    getCacheStats,
    clearCache,
    preloadMedia,
    cache: mediaCacheInstance.cache
  }
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (mediaCacheInstance) {
      mediaCacheInstance.destroy()
    }
  })
}
