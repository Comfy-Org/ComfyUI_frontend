import { describe, expect, it } from 'vitest'

import {
  calculateDragPan,
  calculateFitView,
  calculatePanZoomStyles,
  calculateSingleTouchPan,
  calculateZoomAroundPoint,
  clampZoom,
  easeOutCubic,
  getCursorPoint,
  getDistanceBetweenPoints,
  getMidpoint,
  getWheelZoomFactor,
  interpolateView,
  isDoubleTap
} from './panZoomUtils'

describe('panZoomUtils', () => {
  describe('getDistanceBetweenPoints', () => {
    it('returns 0 for same point', () => {
      expect(getDistanceBetweenPoints({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
    })

    it('calculates horizontal distance', () => {
      expect(getDistanceBetweenPoints({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3)
    })

    it('calculates diagonal distance', () => {
      expect(getDistanceBetweenPoints({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    })
  })

  describe('getMidpoint', () => {
    it('returns midpoint of two points', () => {
      expect(getMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({
        x: 5,
        y: 10
      })
    })

    it('returns same point when both are identical', () => {
      expect(getMidpoint({ x: 7, y: 3 }, { x: 7, y: 3 })).toEqual({
        x: 7,
        y: 3
      })
    })
  })

  describe('clampZoom', () => {
    it('returns value within bounds unchanged', () => {
      expect(clampZoom(1)).toBe(1)
      expect(clampZoom(5)).toBe(5)
    })

    it('clamps to minimum 0.2', () => {
      expect(clampZoom(0.1)).toBe(0.2)
      expect(clampZoom(0)).toBe(0.2)
      expect(clampZoom(-5)).toBe(0.2)
    })

    it('clamps to maximum 10.0', () => {
      expect(clampZoom(15)).toBe(10)
      expect(clampZoom(10.1)).toBe(10)
    })

    it('preserves boundary values exactly', () => {
      expect(clampZoom(0.2)).toBe(0.2)
      expect(clampZoom(10)).toBe(10)
    })
  })

  describe('getWheelZoomFactor', () => {
    it('returns 1.1 for negative deltaY (scroll up = zoom in)', () => {
      expect(getWheelZoomFactor(-100)).toBe(1.1)
      expect(getWheelZoomFactor(-1)).toBe(1.1)
    })

    it('returns 0.9 for positive deltaY (scroll down = zoom out)', () => {
      expect(getWheelZoomFactor(100)).toBe(0.9)
      expect(getWheelZoomFactor(1)).toBe(0.9)
    })

    it('returns 0.9 for zero deltaY', () => {
      expect(getWheelZoomFactor(0)).toBe(0.9)
    })
  })

  describe('calculateZoomAroundPoint', () => {
    it('zooms in and adjusts pan toward focal point', () => {
      const result = calculateZoomAroundPoint(
        1.0,
        1.1,
        { x: 0, y: 0 },
        400,
        300
      )

      expect(result.zoomRatio).toBeCloseTo(1.1)
      expect(result.panOffset.x).toBeLessThan(0)
      expect(result.panOffset.y).toBeLessThan(0)
    })

    it('zooms out and adjusts pan away from focal point', () => {
      const result = calculateZoomAroundPoint(
        1.0,
        0.9,
        { x: 0, y: 0 },
        400,
        300
      )

      expect(result.zoomRatio).toBeCloseTo(0.9)
      expect(result.panOffset.x).toBeGreaterThan(0)
      expect(result.panOffset.y).toBeGreaterThan(0)
    })

    it('clamps zoom to upper bound', () => {
      const result = calculateZoomAroundPoint(9.5, 2.0, { x: 0, y: 0 }, 0, 0)

      expect(result.zoomRatio).toBe(10)
    })

    it('clamps zoom to lower bound', () => {
      const result = calculateZoomAroundPoint(0.3, 0.5, { x: 0, y: 0 }, 0, 0)

      expect(result.zoomRatio).toBe(0.2)
    })

    it('does not shift pan when focal point is at origin', () => {
      const result = calculateZoomAroundPoint(
        1.0,
        1.5,
        { x: 100, y: 200 },
        0,
        0
      )

      expect(result.panOffset.x).toBe(100)
      expect(result.panOffset.y).toBe(200)
    })
  })

  describe('calculateDragPan', () => {
    it('returns initial pan when no movement', () => {
      const result = calculateDragPan(
        { x: 100, y: 200 },
        { x: 100, y: 200 },
        { x: 50, y: 60 }
      )

      expect(result).toEqual({ x: 50, y: 60 })
    })

    it('offsets pan by mouse delta', () => {
      const result = calculateDragPan(
        { x: 100, y: 200 },
        { x: 150, y: 250 },
        { x: 0, y: 0 }
      )

      expect(result).toEqual({ x: 50, y: 50 })
    })

    it('preserves initial pan as base', () => {
      const result = calculateDragPan(
        { x: 100, y: 200 },
        { x: 80, y: 180 },
        { x: 300, y: 400 }
      )

      expect(result).toEqual({ x: 280, y: 380 })
    })
  })

  describe('calculateSingleTouchPan', () => {
    it('returns unchanged pan when no movement', () => {
      const result = calculateSingleTouchPan(
        { x: 100, y: 200 },
        { x: 100, y: 200 },
        { x: 50, y: 60 }
      )

      expect(result).toEqual({ x: 50, y: 60 })
    })

    it('adds touch delta to pan', () => {
      const result = calculateSingleTouchPan(
        { x: 100, y: 200 },
        { x: 150, y: 250 },
        { x: 10, y: 20 }
      )

      expect(result).toEqual({ x: 60, y: 70 })
    })
  })

  describe('getCursorPoint', () => {
    it('subtracts pan offset from client point', () => {
      expect(getCursorPoint({ x: 500, y: 400 }, { x: 100, y: 50 })).toEqual({
        x: 400,
        y: 350
      })
    })

    it('returns client point when offset is zero', () => {
      expect(getCursorPoint({ x: 200, y: 300 }, { x: 0, y: 0 })).toEqual({
        x: 200,
        y: 300
      })
    })
  })

  describe('isDoubleTap', () => {
    it('returns true when within delay', () => {
      expect(isDoubleTap(1100, 1000, 300)).toBe(true)
    })

    it('returns false when outside delay', () => {
      expect(isDoubleTap(1500, 1000, 300)).toBe(false)
    })

    it('returns false when exactly at delay boundary', () => {
      expect(isDoubleTap(1300, 1000, 300)).toBe(false)
    })

    it('returns true when lastTapTime is 0 and currentTime is small', () => {
      expect(isDoubleTap(100, 0, 300)).toBe(true)
    })
  })

  describe('easeOutCubic', () => {
    it('returns 0 at start', () => {
      expect(easeOutCubic(0)).toBe(0)
    })

    it('returns 1 at end', () => {
      expect(easeOutCubic(1)).toBe(1)
    })

    it('returns value between 0 and 1 for midpoint', () => {
      const mid = easeOutCubic(0.5)
      expect(mid).toBeGreaterThan(0)
      expect(mid).toBeLessThan(1)
    })

    it('decelerates (second half has less change than first)', () => {
      const firstHalf = easeOutCubic(0.5)
      const secondHalf = easeOutCubic(1) - easeOutCubic(0.5)
      expect(firstHalf).toBeGreaterThan(secondHalf)
    })
  })

  describe('interpolateView', () => {
    it('returns start values at progress 0', () => {
      const result = interpolateView(
        1,
        2,
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        0
      )

      expect(result.zoomRatio).toBe(1)
      expect(result.panOffset).toEqual({ x: 0, y: 0 })
    })

    it('returns target values at progress 1', () => {
      const result = interpolateView(
        1,
        2,
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        1
      )

      expect(result.zoomRatio).toBe(2)
      expect(result.panOffset).toEqual({ x: 100, y: 200 })
    })

    it('returns halfway values at progress 0.5', () => {
      const result = interpolateView(
        1,
        3,
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        0.5
      )

      expect(result.zoomRatio).toBe(2)
      expect(result.panOffset).toEqual({ x: 50, y: 100 })
    })
  })

  describe('calculateFitView', () => {
    it('fits landscape image width-constrained', () => {
      const result = calculateFitView({
        rootWidth: 1200,
        rootHeight: 800,
        imageWidth: 1000,
        imageHeight: 500,
        toolPanelWidth: 64,
        sidePanelWidth: 220
      })

      const availableWidth = 1200 - 64 - 220
      expect(result.zoomRatio).toBeCloseTo(availableWidth / 1000)
      expect(result.fittedWidth).toBeCloseTo(availableWidth)
      expect(result.panOffset.x).toBe(64)
    })

    it('fits portrait image height-constrained', () => {
      const result = calculateFitView({
        rootWidth: 1200,
        rootHeight: 800,
        imageWidth: 400,
        imageHeight: 1000,
        toolPanelWidth: 64,
        sidePanelWidth: 220
      })

      expect(result.zoomRatio).toBeCloseTo(800 / 1000)
      expect(result.fittedHeight).toBeCloseTo(800)
    })

    it('centers vertically for width-constrained images', () => {
      const result = calculateFitView({
        rootWidth: 1200,
        rootHeight: 800,
        imageWidth: 1000,
        imageHeight: 500,
        toolPanelWidth: 64,
        sidePanelWidth: 220
      })

      expect(result.panOffset.y).toBeGreaterThan(0)
    })

    it('centers horizontally for height-constrained images', () => {
      const result = calculateFitView({
        rootWidth: 1200,
        rootHeight: 800,
        imageWidth: 400,
        imageHeight: 1000,
        toolPanelWidth: 64,
        sidePanelWidth: 220
      })

      expect(result.panOffset.x).toBeGreaterThan(64)
    })

    it('accounts for panel widths in available space', () => {
      const withPanels = calculateFitView({
        rootWidth: 1200,
        rootHeight: 800,
        imageWidth: 800,
        imageHeight: 600,
        toolPanelWidth: 64,
        sidePanelWidth: 220
      })

      const withoutPanels = calculateFitView({
        rootWidth: 1200,
        rootHeight: 800,
        imageWidth: 800,
        imageHeight: 600,
        toolPanelWidth: 0,
        sidePanelWidth: 0
      })

      expect(withPanels.zoomRatio).toBeLessThan(withoutPanels.zoomRatio)
      expect(withPanels.panOffset.x).toBeGreaterThanOrEqual(64)
    })

    it('offsets pan.x by exactly toolPanelWidth for width-constrained fit', () => {
      const result = calculateFitView({
        rootWidth: 1200,
        rootHeight: 800,
        imageWidth: 2000,
        imageHeight: 500,
        toolPanelWidth: 80,
        sidePanelWidth: 200
      })

      expect(result.panOffset.x).toBe(80)
    })

    it('offsets pan.x by toolPanelWidth + centering for height-constrained fit', () => {
      const result = calculateFitView({
        rootWidth: 1200,
        rootHeight: 800,
        imageWidth: 400,
        imageHeight: 1000,
        toolPanelWidth: 64,
        sidePanelWidth: 220
      })

      const availableWidth = 1200 - 64 - 220
      const expectedX = (availableWidth - result.fittedWidth) / 2 + 64

      expect(result.panOffset.x).toBeCloseTo(expectedX)
    })
  })

  describe('calculatePanZoomStyles', () => {
    it('computes container styles from zoom and offset', () => {
      const result = calculatePanZoomStyles(800, 600, 1.5, {
        x: 100,
        y: 50
      })

      expect(result.rawWidth).toBe(1200)
      expect(result.rawHeight).toBe(900)
      expect(result.containerWidth).toBe('1200px')
      expect(result.containerHeight).toBe('900px')
      expect(result.containerLeft).toBe('100px')
      expect(result.containerTop).toBe('50px')
    })

    it('handles zoom ratio of 1', () => {
      const result = calculatePanZoomStyles(800, 600, 1, { x: 0, y: 0 })

      expect(result.rawWidth).toBe(800)
      expect(result.rawHeight).toBe(600)
    })
  })
})
