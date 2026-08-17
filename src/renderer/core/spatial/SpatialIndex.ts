/**
 * Spatial Index Manager
 *
 * Manages spatial indexing for efficient node queries based on bounds.
 * Uses QuadTree for fast spatial lookups with caching for performance.
 */
import {
  PERFORMANCE_CONFIG,
  QUADTREE_CONFIG
} from '@/renderer/core/layout/constants'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'

import { QuadTree } from './QuadTree'

/**
 * Cache entry for spatial queries
 */
interface CacheEntry<TId> {
  result: TId[]
  timestamp: number
}

interface SpatialEntry<TId> {
  bounds: Bounds
  data: TId
}

const ROOT_PADDING = 1000

/**
 * Spatial index manager using QuadTree
 */
export class SpatialIndexManager<TId extends string | number = NodeId> {
  private quadTree: QuadTree<TId>
  private readonly initialBounds: Bounds
  private readonly entries = new Map<string, SpatialEntry<TId>>()
  private readonly unindexableEntries = new Map<string, TId>()
  private readonly queryCache = new Map<string, CacheEntry<TId>>()
  private cacheSize = 0

  constructor(bounds?: Bounds) {
    this.initialBounds = bounds ?? QUADTREE_CONFIG.DEFAULT_BOUNDS
    this.quadTree = this.createQuadTree(this.initialBounds)
  }

  /**
   * Insert a node into the spatial index
   */
  insert(nodeId: TId, bounds: Bounds): void {
    const key = this.getEntryKey(nodeId)
    const existing = this.entries.get(key)
    this.entries.set(key, { bounds, data: nodeId })

    if (!this.isIndexable(bounds)) {
      if (existing && this.isIndexable(existing.bounds)) {
        this.quadTree.remove(key)
      }
      this.unindexableEntries.set(key, nodeId)
      this.invalidateCache()
      return
    }

    this.unindexableEntries.delete(key)
    const indexed = existing
      ? this.quadTree.update(key, bounds)
      : this.quadTree.insert(key, bounds, nodeId)
    if (!indexed) this.rebuild()
    this.invalidateCache()
  }

  /**
   * Update a node's bounds in the spatial index
   */
  update(nodeId: TId, bounds: Bounds): void {
    this.insert(nodeId, bounds)
  }

  /**
   * Batch update multiple nodes' bounds in the spatial index
   * More efficient than calling update() multiple times as it only invalidates cache once
   */
  batchUpdate(updates: Array<{ nodeId: TId; bounds: Bounds }>): void {
    let rebuildRequired = false

    for (const { nodeId, bounds } of updates) {
      const key = this.getEntryKey(nodeId)
      const existing = this.entries.get(key)
      this.entries.set(key, { bounds, data: nodeId })

      if (!this.isIndexable(bounds)) {
        if (existing && this.isIndexable(existing.bounds)) {
          this.quadTree.remove(key)
        }
        this.unindexableEntries.set(key, nodeId)
        continue
      }

      this.unindexableEntries.delete(key)
      const indexed = existing
        ? this.quadTree.update(key, bounds)
        : this.quadTree.insert(key, bounds, nodeId)
      rebuildRequired ||= !indexed
    }

    if (rebuildRequired) this.rebuild()
    this.invalidateCache()
  }

  replaceAll(entries: Iterable<{ nodeId: TId; bounds: Bounds }>): void {
    this.entries.clear()
    for (const { nodeId, bounds } of entries) {
      this.entries.set(this.getEntryKey(nodeId), { bounds, data: nodeId })
    }
    this.rebuild()
    this.invalidateCache()
  }

  /**
   * Remove a node from the spatial index
   */
  remove(nodeId: TId): void {
    const key = this.getEntryKey(nodeId)
    this.entries.delete(key)
    this.unindexableEntries.delete(key)
    this.quadTree.remove(key)
    this.invalidateCache()
  }

  /**
   * Query nodes within the given bounds
   */
  query(bounds: Bounds): TId[] {
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
    const indexed = this.quadTree.query(bounds)
    const result = this.unindexableEntries.size
      ? indexed.concat(Array.from(this.unindexableEntries.values()))
      : indexed

    // Cache result
    this.addToCache(cacheKey, result)

    return result
  }

  /**
   * Clear all nodes from the spatial index
   */
  clear(): void {
    this.entries.clear()
    this.unindexableEntries.clear()
    this.quadTree = this.createQuadTree(this.initialBounds)
    this.invalidateCache()
  }

  /**
   * Get the current size of the index
   */
  get size(): number {
    return this.entries.size
  }

  /**
   * Get debug information about the spatial index
   */
  getDebugInfo() {
    return {
      quadTreeInfo: this.quadTree.getDebugInfo(),
      unindexableEntries: this.unindexableEntries.size,
      cacheSize: this.cacheSize,
      cacheEntries: this.queryCache.size
    }
  }

  private createQuadTree(bounds: Bounds): QuadTree<TId> {
    return new QuadTree<TId>(bounds, {
      maxDepth: QUADTREE_CONFIG.MAX_DEPTH,
      maxItemsPerNode: QUADTREE_CONFIG.MAX_ITEMS_PER_NODE
    })
  }

  private rebuild(): void {
    const indexableEntries = [...this.entries.entries()].filter(([, entry]) =>
      this.isIndexable(entry.bounds)
    )
    const rootBounds = this.getRootBounds(indexableEntries)
    this.quadTree = this.createQuadTree(rootBounds ?? this.initialBounds)
    this.unindexableEntries.clear()

    for (const [key, entry] of this.entries) {
      if (
        !this.isIndexable(entry.bounds) ||
        !rootBounds ||
        !this.quadTree.insert(key, entry.bounds, entry.data)
      ) {
        this.unindexableEntries.set(key, entry.data)
      }
    }
  }

  private getRootBounds(
    entries: Array<[string, SpatialEntry<TId>]>
  ): Bounds | null {
    if (entries.length === 0) return this.initialBounds

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const [, { bounds }] of entries) {
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }

    const root = {
      x: minX - ROOT_PADDING,
      y: minY - ROOT_PADDING,
      width: maxX - minX + ROOT_PADDING * 2,
      height: maxY - minY + ROOT_PADDING * 2
    }
    return this.isIndexable(root) ? root : null
  }

  private isIndexable(bounds: Bounds): boolean {
    return (
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height) &&
      Number.isFinite(bounds.x + bounds.width) &&
      Number.isFinite(bounds.y + bounds.height) &&
      bounds.width >= 0 &&
      bounds.height >= 0
    )
  }

  private getEntryKey(nodeId: TId): string {
    return `${typeof nodeId}:${String(nodeId)}`
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
  private addToCache(key: string, result: TId[]): void {
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
