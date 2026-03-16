import { describe, expect, it } from 'vitest'

import {
  RENDER_SCALE_FACTOR,
  getGraphRenderAnchor,
  unprojectBounds,
  unprojectPoint
} from './graphRenderTransform'

const anchor = { x: 100, y: 100 }

describe('graphRenderTransform', () => {
  describe('unprojectPoint', () => {
    it('divides offset from anchor by scale', () => {
      const point = { x: 220, y: 220 }
      const result = unprojectPoint(point, anchor, RENDER_SCALE_FACTOR)
      expect(result.x).toBeCloseTo(100 + 120 / RENDER_SCALE_FACTOR)
      expect(result.y).toBeCloseTo(100 + 120 / RENDER_SCALE_FACTOR)
    })

    it('is identity when scale is 1', () => {
      const point = { x: 250, y: 300 }
      expect(unprojectPoint(point, anchor, 1)).toEqual(point)
    })

    it('leaves anchor point unchanged', () => {
      const result = unprojectPoint(anchor, anchor, RENDER_SCALE_FACTOR)
      expect(result).toEqual(anchor)
    })
  })

  describe('unprojectBounds', () => {
    it('unprojects position and shrinks dimensions', () => {
      const bounds = { x: 220, y: 220, width: 120, height: 60 }
      const result = unprojectBounds(bounds, anchor, RENDER_SCALE_FACTOR)
      expect(result.x).toBeCloseTo(100 + 120 / RENDER_SCALE_FACTOR)
      expect(result.y).toBeCloseTo(100 + 120 / RENDER_SCALE_FACTOR)
      expect(result.width).toBeCloseTo(120 / RENDER_SCALE_FACTOR)
      expect(result.height).toBeCloseTo(60 / RENDER_SCALE_FACTOR)
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
