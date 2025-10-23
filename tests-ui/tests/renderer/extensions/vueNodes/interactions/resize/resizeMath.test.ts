import { describe, expect, it, vi } from 'vitest'

import {
  computeResizeOutcome,
  createResizeSession,
  toCanvasDelta
} from '@/renderer/extensions/vueNodes/interactions/resize/resizeMath'

describe('nodeResizeMath', () => {
  const startSize = { width: 200, height: 120 }
  const startPosition = { x: 80, y: 160 }
  const minSize = { width: 120, height: 80 }

  it('computes resize from bottom-right corner without moving position', () => {
    const outcome = computeResizeOutcome({
      startSize,
      startPosition,
      delta: { x: 40, y: 20 },
      minSize,
      handle: { horizontal: 'right', vertical: 'bottom' }
    })

    expect(outcome.size).toEqual({ width: 240, height: 140 })
    expect(outcome.position).toEqual(startPosition)
  })

  it('computes resize from top-left corner adjusting position', () => {
    const outcome = computeResizeOutcome({
      startSize,
      startPosition,
      delta: { x: -30, y: -20 },
      minSize,
      handle: { horizontal: 'left', vertical: 'top' }
    })

    expect(outcome.size).toEqual({ width: 230, height: 140 })
    expect(outcome.position).toEqual({ x: 50, y: 140 })
  })

  it('clamps to minimum size when shrinking below intrinsic size', () => {
    const outcome = computeResizeOutcome({
      startSize,
      startPosition,
      delta: { x: 500, y: 500 },
      minSize,
      handle: { horizontal: 'left', vertical: 'top' }
    })

    expect(outcome.size).toEqual(minSize)
    expect(outcome.position).toEqual({
      x: startPosition.x + (startSize.width - minSize.width),
      y: startPosition.y + (startSize.height - minSize.height)
    })
  })

  it('supports reusable resize sessions with snapping', () => {
    const session = createResizeSession({
      startSize,
      startPosition,
      minSize,
      handle: { horizontal: 'right', vertical: 'bottom' }
    })

    const snapFn = vi.fn((size: typeof startSize) => ({
      width: Math.round(size.width / 25) * 25,
      height: Math.round(size.height / 25) * 25
    }))

    const applied = session({ x: 13, y: 17 }, snapFn)

    expect(applied.size).toEqual({ width: 225, height: 125 })
    expect(applied.position).toEqual(startPosition)
    expect(snapFn).toHaveBeenCalled()
  })

  it('converts screen delta to canvas delta using scale', () => {
    const delta = toCanvasDelta({ x: 50, y: 75 }, { x: 150, y: 135 }, 2)

    expect(delta).toEqual({ x: 50, y: 30 })
  })

  describe('edge cases', () => {
    it('handles zero scale by using fallback scale of 1', () => {
      const delta = toCanvasDelta({ x: 50, y: 75 }, { x: 150, y: 135 }, 0)

      expect(delta).toEqual({ x: 100, y: 60 })
    })

    it('handles negative deltas when resizing from right/bottom', () => {
      const outcome = computeResizeOutcome({
        startSize,
        startPosition,
        delta: { x: -50, y: -30 },
        minSize,
        handle: { horizontal: 'right', vertical: 'bottom' }
      })

      expect(outcome.size).toEqual({ width: 150, height: 90 })
      expect(outcome.position).toEqual(startPosition)
    })

    it('handles very large deltas without overflow', () => {
      const outcome = computeResizeOutcome({
        startSize,
        startPosition,
        delta: { x: 10000, y: 10000 },
        minSize,
        handle: { horizontal: 'right', vertical: 'bottom' }
      })

      expect(outcome.size.width).toBe(10200)
      expect(outcome.size.height).toBe(10120)
      expect(outcome.position).toEqual(startPosition)
    })

    it('respects minimum size even with extreme negative deltas', () => {
      const outcome = computeResizeOutcome({
        startSize,
        startPosition,
        delta: { x: -1000, y: -1000 },
        minSize,
        handle: { horizontal: 'right', vertical: 'bottom' }
      })

      expect(outcome.size).toEqual(minSize)
      expect(outcome.position).toEqual(startPosition)
    })

    it('handles minSize larger than startSize', () => {
      const largeMinSize = { width: 300, height: 200 }
      const outcome = computeResizeOutcome({
        startSize,
        startPosition,
        delta: { x: 10, y: 10 },
        minSize: largeMinSize,
        handle: { horizontal: 'right', vertical: 'bottom' }
      })

      expect(outcome.size).toEqual(largeMinSize)
      expect(outcome.position).toEqual(startPosition)
    })

    it('adjusts position correctly when minSize prevents shrinking from top-left', () => {
      const largeMinSize = { width: 250, height: 150 }
      const outcome = computeResizeOutcome({
        startSize,
        startPosition,
        delta: { x: 100, y: 100 },
        minSize: largeMinSize,
        handle: { horizontal: 'left', vertical: 'top' }
      })

      expect(outcome.size).toEqual(largeMinSize)
      expect(outcome.position).toEqual({
        x: startPosition.x + (startSize.width - largeMinSize.width),
        y: startPosition.y + (startSize.height - largeMinSize.height)
      })
    })
  })
})
