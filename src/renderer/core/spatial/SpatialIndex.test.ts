import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Bounds } from '@/renderer/core/layout/types'
import { SpatialIndexManager } from '@/renderer/core/spatial/SpatialIndex'

describe('SpatialIndexManager', () => {
  let index: SpatialIndexManager
  const worldBounds: Bounds = { x: 0, y: 0, width: 2000, height: 2000 }

  beforeEach(() => {
    index = new SpatialIndexManager(worldBounds)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('insert and query', () => {
    it('should find an inserted node within query bounds', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      const results = index.query({ x: 80, y: 80, width: 100, height: 100 })

      expect(results).toContain('node1')
    })

    it('should not find a node outside query bounds', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      const results = index.query({ x: 500, y: 500, width: 100, height: 100 })

      expect(results).not.toContain('node1')
    })

    it('should find multiple nodes within query bounds', () => {
      index.insert('a', { x: 10, y: 10, width: 20, height: 20 })
      index.insert('b', { x: 50, y: 50, width: 20, height: 20 })
      index.insert('c', { x: 800, y: 800, width: 20, height: 20 })

      const results = index.query({ x: 0, y: 0, width: 100, height: 100 })

      expect(results).toContain('a')
      expect(results).toContain('b')
      expect(results).not.toContain('c')
    })
  })

  describe('update', () => {
    it('should reflect updated bounds in subsequent queries', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      index.update('node1', { x: 900, y: 900, width: 50, height: 50 })

      const oldArea = index.query({ x: 80, y: 80, width: 100, height: 100 })
      expect(oldArea).not.toContain('node1')

      const newArea = index.query({ x: 880, y: 880, width: 100, height: 100 })
      expect(newArea).toContain('node1')
    })
  })

  describe('remove', () => {
    it('should no longer find a removed node', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      index.remove('node1')

      const results = index.query({ x: 80, y: 80, width: 100, height: 100 })
      expect(results).not.toContain('node1')
    })

    it('should decrement size after removal', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })
      expect(index.size).toBe(1)

      index.remove('node1')
      expect(index.size).toBe(0)
    })
  })

  describe('batchUpdate', () => {
    it('should move multiple nodes atomically', () => {
      index.insert('a', { x: 10, y: 10, width: 20, height: 20 })
      index.insert('b', { x: 50, y: 50, width: 20, height: 20 })

      index.batchUpdate([
        { nodeId: 'a', bounds: { x: 900, y: 900, width: 20, height: 20 } },
        { nodeId: 'b', bounds: { x: 950, y: 950, width: 20, height: 20 } }
      ])

      const oldArea = index.query({ x: 0, y: 0, width: 100, height: 100 })
      expect(oldArea).toHaveLength(0)

      const newArea = index.query({ x: 880, y: 880, width: 200, height: 200 })
      expect(newArea).toContain('a')
      expect(newArea).toContain('b')
    })
  })

  describe('clear', () => {
    it('should remove all nodes', () => {
      index.insert('a', { x: 10, y: 10, width: 20, height: 20 })
      index.insert('b', { x: 50, y: 50, width: 20, height: 20 })

      index.clear()

      expect(index.size).toBe(0)
      const results = index.query({ x: 0, y: 0, width: 2000, height: 2000 })
      expect(results).toHaveLength(0)
    })
  })

  describe('size', () => {
    it('should track the number of indexed nodes', () => {
      expect(index.size).toBe(0)

      index.insert('a', { x: 10, y: 10, width: 20, height: 20 })
      expect(index.size).toBe(1)

      index.insert('b', { x: 50, y: 50, width: 20, height: 20 })
      expect(index.size).toBe(2)

      index.remove('a')
      expect(index.size).toBe(1)
    })
  })

  describe('query caching', () => {
    it('should return the same result array for repeated identical queries', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      const queryBounds: Bounds = { x: 80, y: 80, width: 100, height: 100 }
      const first = index.query(queryBounds)
      const second = index.query(queryBounds)

      // Cached result should be the exact same reference
      expect(second).toBe(first)
    })

    it('should invalidate cache after insert', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      const queryBounds: Bounds = { x: 80, y: 80, width: 200, height: 200 }
      const before = index.query(queryBounds)
      expect(before).toHaveLength(1)

      index.insert('node2', { x: 150, y: 150, width: 50, height: 50 })
      const after = index.query(queryBounds)

      expect(after).toHaveLength(2)
      // Should be a new result, not the cached one
      expect(after).not.toBe(before)
    })

    it('should invalidate cache after update', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      const queryBounds: Bounds = { x: 80, y: 80, width: 100, height: 100 }
      const before = index.query(queryBounds)
      expect(before).toContain('node1')

      index.update('node1', { x: 900, y: 900, width: 50, height: 50 })
      const after = index.query(queryBounds)

      expect(after).not.toContain('node1')
      expect(after).not.toBe(before)
    })

    it('should invalidate cache after remove', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      const queryBounds: Bounds = { x: 80, y: 80, width: 100, height: 100 }
      const before = index.query(queryBounds)
      expect(before).toContain('node1')

      index.remove('node1')
      const after = index.query(queryBounds)

      expect(after).not.toContain('node1')
      expect(after).not.toBe(before)
    })

    it('should invalidate cache after clear', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      const queryBounds: Bounds = { x: 80, y: 80, width: 100, height: 100 }
      const before = index.query(queryBounds)
      expect(before).toHaveLength(1)

      index.clear()
      const after = index.query(queryBounds)

      expect(after).toHaveLength(0)
      expect(after).not.toBe(before)
    })

    it('should invalidate cache after batchUpdate', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })

      const queryBounds: Bounds = { x: 80, y: 80, width: 100, height: 100 }
      const before = index.query(queryBounds)
      expect(before).toContain('node1')

      index.batchUpdate([
        { nodeId: 'node1', bounds: { x: 900, y: 900, width: 50, height: 50 } }
      ])
      const after = index.query(queryBounds)

      expect(after).not.toContain('node1')
      expect(after).not.toBe(before)
    })
  })

  describe('getDebugInfo', () => {
    it('should report cache and tree state', () => {
      index.insert('node1', { x: 100, y: 100, width: 50, height: 50 })
      index.query({ x: 80, y: 80, width: 100, height: 100 })

      const info = index.getDebugInfo()

      expect(info.quadTreeInfo.size).toBe(1)
      expect(info.cacheSize).toBe(1)
      expect(info.cacheEntries).toBe(1)
    })
  })

  describe('default bounds', () => {
    it('should use default bounds when none are provided', () => {
      const defaultIndex = new SpatialIndexManager()

      // The default bounds from QUADTREE_CONFIG cover -10000 to 10000
      defaultIndex.insert('node1', { x: 0, y: 0, width: 50, height: 50 })
      const results = defaultIndex.query({
        x: 0,
        y: 0,
        width: 100,
        height: 100
      })

      expect(results).toContain('node1')
    })
  })
})
