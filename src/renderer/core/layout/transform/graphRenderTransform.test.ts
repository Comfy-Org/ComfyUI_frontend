import { describe, expect, it } from 'vitest'

import {
  RENDER_SCALE_FACTOR,
  getGraphRenderAnchor,
  projectBounds,
  projectPoint,
  unprojectBounds,
  unprojectPoint
} from './graphRenderTransform'

const anchor = { x: 100, y: 100 }

describe('graphRenderTransform', () => {
  describe('projectPoint / unprojectPoint', () => {
    it('round-trips correctly', () => {
      const point = { x: 320, y: 140 }
      const projected = projectPoint(point, anchor, RENDER_SCALE_FACTOR)
      const restored = unprojectPoint(projected, anchor, RENDER_SCALE_FACTOR)
      expect(restored.x).toBeCloseTo(point.x, 10)
      expect(restored.y).toBeCloseTo(point.y, 10)
    })

    it('is identity when scale is 1', () => {
      const point = { x: 250, y: 300 }
      expect(projectPoint(point, anchor, 1)).toEqual(point)
      expect(unprojectPoint(point, anchor, 1)).toEqual(point)
    })

    it('scales relative to anchor', () => {
      const point = { x: 200, y: 200 }
      const projected = projectPoint(point, anchor, RENDER_SCALE_FACTOR)
      expect(projected.x).toBeCloseTo(100 + 100 * RENDER_SCALE_FACTOR)
      expect(projected.y).toBeCloseTo(100 + 100 * RENDER_SCALE_FACTOR)
    })

    it('leaves anchor point unchanged', () => {
      const projected = projectPoint(anchor, anchor, RENDER_SCALE_FACTOR)
      expect(projected).toEqual(anchor)
    })
  })

  describe('projectBounds / unprojectBounds', () => {
    it('round-trips correctly', () => {
      const bounds = { x: 200, y: 150, width: 120, height: 80 }
      const projected = projectBounds(bounds, anchor, RENDER_SCALE_FACTOR)
      const restored = unprojectBounds(projected, anchor, RENDER_SCALE_FACTOR)
      expect(restored.x).toBeCloseTo(bounds.x, 10)
      expect(restored.y).toBeCloseTo(bounds.y, 10)
      expect(restored.width).toBeCloseTo(bounds.width, 10)
      expect(restored.height).toBeCloseTo(bounds.height, 10)
    })

    it('scales width and height by scale factor', () => {
      const bounds = { x: 100, y: 100, width: 100, height: 50 }
      const projected = projectBounds(bounds, anchor, RENDER_SCALE_FACTOR)
      expect(projected.width).toBeCloseTo(100 * RENDER_SCALE_FACTOR)
      expect(projected.height).toBeCloseTo(50 * RENDER_SCALE_FACTOR)
    })
  })

  describe('getGraphRenderAnchor', () => {
    it('returns cached anchor on subsequent calls', () => {
      const mockGraph = {
        nodes: [
          {
            pos: [100, 200],
            size: [120, 80],
            get width() {
              return this.size[0]
            },
            get boundingRect() {
              return [this.pos[0], this.pos[1], this.size[0], this.size[1]]
            }
          },
          {
            pos: [300, 400],
            size: [100, 60],
            get width() {
              return this.size[0]
            },
            get boundingRect() {
              return [this.pos[0], this.pos[1], this.size[0], this.size[1]]
            }
          }
        ]
      }

      const anchor1 = getGraphRenderAnchor(mockGraph as never)
      // Mutate positions — anchor should stay frozen
      mockGraph.nodes[0].pos = [500, 600]
      const anchor2 = getGraphRenderAnchor(mockGraph as never)

      expect(anchor1).toBe(anchor2)
    })

    it('returns origin for empty graph', () => {
      const mockGraph = { nodes: [] }
      const anchor = getGraphRenderAnchor(mockGraph as never)
      expect(anchor).toEqual({ x: 0, y: 0 })
    })
  })
})
