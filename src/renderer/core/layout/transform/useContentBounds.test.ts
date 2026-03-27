import { describe, expect, it } from 'vitest'

import { useContentBounds } from '@/renderer/core/layout/transform/useContentBounds'

describe('useContentBounds', () => {
  describe('initial state', () => {
    it('has zero offset and size', () => {
      const { offset, size } = useContentBounds()
      expect(offset).toEqual({ x: 0, y: 0 })
      expect(size).toEqual({ width: 0, height: 0 })
    })
  })

  describe('expandToInclude', () => {
    it('expands to cover bounds in positive space', () => {
      const cb = useContentBounds()
      cb.expandToInclude({ x: 100, y: 200, width: 300, height: 150 })
      cb.flush()

      // Offset should be 0 because bounds are already positive
      // (min stays 0 since initial min is 0 and bounds.x > 0)
      expect(cb.offset.x).toBe(0)
      expect(cb.offset.y).toBe(0)
      // Size covers from min(0) to max(100+300+margin)
      expect(cb.size.width).toBeGreaterThan(400)
      expect(cb.size.height).toBeGreaterThan(350)
    })

    it('generates offset for bounds in negative space', () => {
      const cb = useContentBounds()
      cb.expandToInclude({ x: -500, y: -300, width: 100, height: 50 })
      cb.flush()

      // offset.x should shift -500 into positive range (plus margin)
      expect(cb.offset.x).toBeGreaterThan(500)
      expect(cb.offset.y).toBeGreaterThan(300)
    })

    it('preserves coordinate identity: offset cancels in transform chain', () => {
      const cb = useContentBounds()
      cb.expandToInclude({ x: -1000, y: -2000, width: 500, height: 300 })
      cb.flush()

      // Simulate the transform chain for a node at (-1000, -2000)
      const nodeX = -1000
      const nodeY = -2000
      const camX = 50
      const camY = 30
      const z = 1.5

      // With offset wrapper:
      // Node DOM position: nodeX + offset.x, nodeY + offset.y
      // TransformPane camera: camX - offset.x, camY - offset.y
      // Screen = ((nodeX + offset.x) + (camX - offset.x)) * z
      //        = (nodeX + camX) * z
      const screenX = (nodeX + cb.offset.x + (camX - cb.offset.x)) * z
      const screenY = (nodeY + cb.offset.y + (camY - cb.offset.y)) * z

      expect(screenX).toBeCloseTo((nodeX + camX) * z)
      expect(screenY).toBeCloseTo((nodeY + camY) * z)
    })

    it('uses grow-only strategy', () => {
      const cb = useContentBounds()

      cb.expandToInclude({ x: -500, y: -500, width: 100, height: 100 })
      cb.flush()
      const firstOffset = { x: cb.offset.x, y: cb.offset.y }
      const firstSize = { width: cb.size.width, height: cb.size.height }

      // Expand with bounds inside existing tracked area — no change
      cb.expandToInclude({ x: -100, y: -100, width: 50, height: 50 })
      cb.flush()
      expect(cb.offset.x).toBe(firstOffset.x)
      expect(cb.offset.y).toBe(firstOffset.y)
      expect(cb.size.width).toBe(firstSize.width)
      expect(cb.size.height).toBe(firstSize.height)

      // Expand beyond existing area — grows
      // First expansion set minX = -500 - margin, so we need x below that
      cb.expandToInclude({ x: -5000, y: 0, width: 100, height: 100 })
      cb.flush()
      expect(cb.offset.x).toBeGreaterThan(firstOffset.x)
    })
  })

  describe('expandToIncludePoint', () => {
    it('expands to include a single point', () => {
      const cb = useContentBounds()
      cb.expandToIncludePoint({ x: -800, y: 500 })
      cb.flush()

      expect(cb.offset.x).toBeGreaterThan(800)
      // y=500 is positive, doesn't push minY below 0 → offset.y stays 0
      // maxY expands to 500 + margin
      expect(cb.offset.y).toBe(0)
      expect(cb.size.height).toBeGreaterThan(500)
    })
  })

  describe('flush', () => {
    it('returns false when nothing changed', () => {
      const cb = useContentBounds()
      expect(cb.flush()).toBe(false)
    })

    it('returns true when bounds expanded', () => {
      const cb = useContentBounds()
      cb.expandToInclude({ x: -100, y: 0, width: 50, height: 50 })
      expect(cb.flush()).toBe(true)
    })

    it('returns false on second flush without new expansions', () => {
      const cb = useContentBounds()
      cb.expandToInclude({ x: -100, y: 0, width: 50, height: 50 })
      cb.flush()
      expect(cb.flush()).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears offset and size to zero', () => {
      const cb = useContentBounds()
      cb.expandToInclude({ x: -1000, y: -500, width: 200, height: 100 })
      cb.flush()

      expect(cb.offset.x).toBeGreaterThan(0)

      cb.reset()
      expect(cb.offset).toEqual({ x: 0, y: 0 })
      expect(cb.size).toEqual({ width: 0, height: 0 })
    })

    it('allows fresh expansion after reset', () => {
      const cb = useContentBounds()
      cb.expandToInclude({ x: -5000, y: -5000, width: 100, height: 100 })
      cb.flush()
      const largeOffset = cb.offset.x

      cb.reset()
      cb.expandToInclude({ x: -100, y: -100, width: 50, height: 50 })
      cb.flush()

      expect(cb.offset.x).toBeLessThan(largeOffset)
      expect(cb.offset.x).toBeGreaterThan(100)
    })
  })

  describe('all node positions remain positive after offset', () => {
    it('handles mixed positive and negative coordinates', () => {
      const cb = useContentBounds()

      const nodes = [
        { x: -3000, y: -2000, width: 200, height: 100 },
        { x: 500, y: 300, width: 150, height: 80 },
        { x: -100, y: 1000, width: 250, height: 120 },
        { x: 2000, y: -500, width: 180, height: 90 }
      ]

      for (const n of nodes) {
        cb.expandToInclude(n)
      }
      cb.flush()

      // Every node's offset position should be non-negative
      for (const n of nodes) {
        expect(n.x + cb.offset.x).toBeGreaterThanOrEqual(0)
        expect(n.y + cb.offset.y).toBeGreaterThanOrEqual(0)
      }

      // Every node's offset right/bottom edge should be within the size
      for (const n of nodes) {
        expect(n.x + n.width + cb.offset.x).toBeLessThanOrEqual(cb.size.width)
        expect(n.y + n.height + cb.offset.y).toBeLessThanOrEqual(cb.size.height)
      }
    })
  })
})
