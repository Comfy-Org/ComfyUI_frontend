import { describe, expect, it } from 'vitest'

import { calculateNodeBounds } from '@/renderer/core/spatial/boundsCalculator'

describe('boundsCalculator', () => {
  describe('calculateNodeBounds', () => {
    it('should calculate bounds for single node', () => {
      const nodes = [{ pos: [100, 200], size: [150, 100] }]

      const bounds = calculateNodeBounds(nodes)

      expect(bounds).toEqual({
        minX: 100,
        minY: 200,
        maxX: 250,
        maxY: 300,
        width: 150,
        height: 100
      })
    })

    it('should calculate bounds for multiple nodes', () => {
      const nodes = [
        { pos: [100, 200], size: [150, 100] },
        { pos: [300, 400], size: [200, 150] },
        { pos: [50, 100], size: [100, 80] }
      ]

      const bounds = calculateNodeBounds(nodes)

      expect(bounds).toEqual({
        minX: 50,
        minY: 100,
        maxX: 500,
        maxY: 550,
        width: 450,
        height: 450
      })
    })

    it('should return null for empty array', () => {
      const nodes: Array<{ pos: ArrayLike<number>; size: ArrayLike<number> }> =
        []

      const bounds = calculateNodeBounds(nodes)

      expect(bounds).toBeNull()
    })

    it('should handle nodes with negative coordinates', () => {
      const nodes = [
        { pos: [-100, -200], size: [150, 100] },
        { pos: [50, 100], size: [100, 80] }
      ]

      const bounds = calculateNodeBounds(nodes)

      expect(bounds).toEqual({
        minX: -100,
        minY: -200,
        maxX: 150,
        maxY: 180,
        width: 250,
        height: 380
      })
    })

    it('should accept TypedArray for position and size', () => {
      const nodes = [
        { pos: new Float32Array([100, 200]), size: [150, 100] },
        { pos: new Float64Array([300, 400]), size: new Float32Array([200, 150]) }
      ]

      const bounds = calculateNodeBounds(nodes)

      expect(bounds).not.toBeNull()
      expect(bounds!.minX).toBe(100)
      expect(bounds!.minY).toBe(200)
    })

    it('should handle large number of nodes efficiently', () => {
      const nodes = Array.from({ length: 10000 }, (_, i) => ({
        pos: [i * 10, i * 10],
        size: [100, 100]
      }))

      const start = performance.now()
      const bounds = calculateNodeBounds(nodes)
      const end = performance.now()

      expect(bounds).not.toBeNull()
      expect(end - start).toBeLessThan(100)
    })
  })
})