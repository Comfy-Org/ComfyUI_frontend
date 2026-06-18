/**
 * Spatial Index Manager
 *
 * Spatial index for entity queries by bounds. QuadTree + cache.
 *
 * Generic over key type → indexes nodes, slots, link segments, reroutes
 * without laundering unrelated keys through `NodeId` brand.
 */
import {
  PERFORMANCE_CONFIG,
  QUADTREE_CONFIG
} from '@/renderer/core/layout/constants'
import type { Bounds } from '@/renderer/core/layout/types'

import { QuadTree } from './QuadTree'

/**
 * Cache entry for spatial queries
 */
interface CacheEntry<K extends string | number> {
  result: K[]
  timestamp: number
}

/**
 * Spatial index manager using QuadTree
 */
export class SpatialIndexManager<K extends string | number = string> {
  private quadTree: QuadTree<K>
  private queryCache: Map<string, CacheEntry<K>>
  private cacheSize = 0

  constructor(bounds?: Bounds) {
    this.quadTree = new QuadTree<K>(bounds ?? QUADTREE_CONFIG.DEFAULT_BOUNDS, {
      maxDepth: QUADTREE_CONFIG.MAX_DEPTH,
      maxItemsPerNode: QUADTREE_CONFIG.MAX_ITEMS_PER_NODE
    })
    this.queryCache = new Map()
  }

  /**
   * Insert an entity into the spatial index
   */
  insert(id: K, bounds: Bounds): void {
    this.quadTree.insert(String(id), bounds, id)
    this.invalidateCache()
  }

  /**
   * Update an entity's bounds in the spatial index
   */
  update(id: K, bounds: Bounds): void {
    this.quadTree.update(String(id), bounds)
    this.invalidateCache()
  }

  /**
   * Batch update multiple entities' bounds in the spatial index
   * More efficient than calling update() multiple times as it only invalidates cache once
   */
  batchUpdate(updates: Array<{ id: K; bounds: Bounds }>): void {
    for (const { id, bounds } of updates) {
      this.quadTree.update(String(id), bounds)
    }
    this.invalidateCache()
  }

  /**
   * Remove an entity from the spatial index
   */
  remove(id: K): void {
    this.quadTree.remove(String(id))
    this.invalidateCache()
  }

  /**
   * Query entities within the given bounds
   */
  query(bounds: Bounds): K[] {
    const cacheKey = this.getCacheKey(bounds)
    const cached = this.queryCache.get(cacheKey)

    // Check cache validity
    if (cached) {
      const age = Date.now() - cached.timestamp
      if (age < PERFORMANCE_CONFIG.SPATIAL_CACHE_TTL) {
        return cached.result
      }
      // Remove stale entry
      this.queryCache.delete(cacheKey)
      this.cacheSize--
    }

    // Perform query
    const result = this.quadTree.query(bounds)

    // Cache result
    this.addToCache(cacheKey, result)

    return result
  }

  /**
   * Clear all nodes from the spatial index
   */
  clear(): void {
    this.quadTree.clear()
    this.invalidateCache()
  }

  /**
   * Get the current size of the index
   */
  get size(): number {
    return this.quadTree.size
  }

  /**
   * Get debug information about the spatial index
   */
  getDebugInfo() {
    return {
      quadTreeInfo: this.quadTree.getDebugInfo(),
      cacheSize: this.cacheSize,
      cacheEntries: this.queryCache.size
    }
  }

  /**
   * Generate cache key for bounds
   */
  private getCacheKey(bounds: Bounds): string {
    return `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`
  }

  /**
   * Add result to cache with LRU eviction
   */
  private addToCache(key: string, result: K[]): void {
    // Evict oldest entries if cache is full
    if (this.cacheSize >= PERFORMANCE_CONFIG.SPATIAL_CACHE_MAX_SIZE) {
      const oldestKey = this.findOldestCacheEntry()
      if (oldestKey) {
        this.queryCache.delete(oldestKey)
        this.cacheSize--
      }
    }

    this.queryCache.set(key, {
      result,
      timestamp: Date.now()
    })
    this.cacheSize++
  }

  /**
   * Find oldest cache entry for LRU eviction
   */
  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.queryCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    return oldestKey
  }

  /**
   * Invalidate all cached queries
   */
  private invalidateCache(): void {
    this.queryCache.clear()
    this.cacheSize = 0
  }
}
