import { describe, expect, it } from 'vitest'

import {
  REROUTE_RADIUS,
  boundsIntersect,
  makeLinkSegmentKey,
  pointInBounds
} from '@/renderer/core/layout/utils/layoutMath'

describe('layoutMath utils', () => {
  describe('makeLinkSegmentKey', () => {
    it('creates stable keys for null reroute', () => {
      expect(makeLinkSegmentKey(10, null)).toBe('10:final')
      expect(makeLinkSegmentKey(42, null)).toBe('42:final')
    })

    it('creates stable keys for numeric reroute ids', () => {
      expect(makeLinkSegmentKey(10, 3)).toBe('10:3')
      expect(makeLinkSegmentKey(42, 0)).toBe('42:0')
      expect(makeLinkSegmentKey(42, 7)).toBe('42:7')
    })
  })

  describe('pointInBounds', () => {
    it('detects inclusion correctly', () => {
      const bounds = { x: 10, y: 10, width: 100, height: 50 }
      expect(pointInBounds({ x: 10, y: 10 }, bounds)).toBe(true)
      expect(pointInBounds({ x: 110, y: 60 }, bounds)).toBe(true)
      expect(pointInBounds({ x: 9, y: 10 }, bounds)).toBe(false)
      expect(pointInBounds({ x: 111, y: 10 }, bounds)).toBe(false)
      expect(pointInBounds({ x: 10, y: 61 }, bounds)).toBe(false)
    })

    it('works with zero-size bounds', () => {
      const zero = { x: 10, y: 20, width: 0, height: 0 }
      expect(pointInBounds({ x: 10, y: 20 }, zero)).toBe(true)
      expect(pointInBounds({ x: 10, y: 21 }, zero)).toBe(false)
      expect(pointInBounds({ x: 9, y: 20 }, zero)).toBe(false)
    })
  })

  describe('boundsIntersect', () => {
    it('detects intersection correctly', () => {
      const a = { x: 0, y: 0, width: 10, height: 10 }
      const b = { x: 5, y: 5, width: 10, height: 10 }
      const c = { x: 11, y: 0, width: 5, height: 5 }
      expect(boundsIntersect(a, b)).toBe(true)
      expect(boundsIntersect(a, c)).toBe(false)
    })

    it('treats touching edges as intersecting', () => {
      const a = { x: 0, y: 0, width: 10, height: 10 }
      const d = { x: 10, y: 0, width: 5, height: 5 } // touches at right edge
      expect(boundsIntersect(a, d)).toBe(true)
    })
  })

  describe('REROUTE_RADIUS', () => {
    it('exports a sensible reroute radius', () => {
      expect(REROUTE_RADIUS).toBeGreaterThan(0)
    })
  })
})
