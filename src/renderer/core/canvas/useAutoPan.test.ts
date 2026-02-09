import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DragAndScale } from '@/lib/litegraph/src/DragAndScale'

import {
  AutoPanController,
  calculateEdgePanSpeed
} from '@/renderer/core/canvas/useAutoPan'

describe('calculateEdgePanSpeed', () => {
  it('returns 0 when pointer is in the center', () => {
    expect(calculateEdgePanSpeed(500, 0, 1000, 1)).toBe(0)
  })

  it('returns negative speed near the left/top edge', () => {
    const speed = calculateEdgePanSpeed(10, 0, 1000, 1)
    expect(speed).toBeLessThan(0)
  })

  it('returns positive speed near the right/bottom edge', () => {
    const speed = calculateEdgePanSpeed(990, 0, 1000, 1)
    expect(speed).toBeGreaterThan(0)
  })

  it('returns max speed at the exact edge', () => {
    const speed = calculateEdgePanSpeed(0, 0, 1000, 1)
    expect(speed).toBe(-15)
  })

  it('returns 0 at exactly the threshold boundary', () => {
    const speed = calculateEdgePanSpeed(50, 0, 1000, 1)
    expect(speed).toBe(0)
  })

  it('scales speed linearly with edge proximity', () => {
    const halfwaySpeed = calculateEdgePanSpeed(25, 0, 1000, 1)
    const quarterSpeed = calculateEdgePanSpeed(37.5, 0, 1000, 1)

    expect(halfwaySpeed).toBeCloseTo(-15 * 0.5)
    expect(quarterSpeed).toBeCloseTo(-15 * 0.25)
  })

  it('divides speed by scale (zoom level)', () => {
    const speedAtScale1 = calculateEdgePanSpeed(0, 0, 1000, 1)
    const speedAtScale2 = calculateEdgePanSpeed(0, 0, 1000, 2)

    expect(speedAtScale2).toBe(speedAtScale1 / 2)
  })

  it('returns max speed when pointer is outside bounds', () => {
    expect(calculateEdgePanSpeed(-10, 0, 1000, 1)).toBe(-15)
    expect(calculateEdgePanSpeed(1010, 0, 1000, 1)).toBe(15)
  })
})

describe('AutoPanController', () => {
  let mockCanvas: HTMLCanvasElement
  let mockDs: DragAndScale
  let onPanMock: ReturnType<typeof vi.fn<(dx: number, dy: number) => void>>
  let controller: AutoPanController

  beforeEach(() => {
    vi.useFakeTimers()

    mockCanvas = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {}
      })
    } as unknown as HTMLCanvasElement

    mockDs = {
      offset: [0, 0],
      scale: 1
    } as unknown as DragAndScale

    onPanMock = vi.fn<(dx: number, dy: number) => void>()
    controller = new AutoPanController({
      canvas: mockCanvas,
      ds: mockDs,
      onPan: onPanMock
    })
  })

  afterEach(() => {
    controller.stop()
    vi.useRealTimers()
  })

  it('does not pan when pointer is in the center', () => {
    controller.updatePointer(400, 300)
    controller.start()

    vi.advanceTimersByTime(16)

    expect(onPanMock).not.toHaveBeenCalled()
  })

  it('pans when pointer is near the right edge', () => {
    controller.updatePointer(790, 300)
    controller.start()

    vi.advanceTimersByTime(16)

    expect(onPanMock).toHaveBeenCalled()
    const [dx, dy] = onPanMock.mock.calls[0]
    expect(dx).toBeGreaterThan(0)
    expect(dy).toBe(0)
  })

  it('pans when pointer is near the bottom edge', () => {
    controller.updatePointer(400, 590)
    controller.start()

    vi.advanceTimersByTime(16)

    expect(onPanMock).toHaveBeenCalled()
    const [dx, dy] = onPanMock.mock.calls[0]
    expect(dx).toBe(0)
    expect(dy).toBeGreaterThan(0)
  })

  it('pans diagonally when pointer is near a corner', () => {
    controller.updatePointer(790, 590)
    controller.start()

    vi.advanceTimersByTime(16)

    expect(onPanMock).toHaveBeenCalled()
    const [dx, dy] = onPanMock.mock.calls[0]
    expect(dx).toBeGreaterThan(0)
    expect(dy).toBeGreaterThan(0)
  })

  it('updates ds.offset when panning', () => {
    controller.updatePointer(0, 300)
    controller.start()

    vi.advanceTimersByTime(16)

    expect(mockDs.offset[0]).toBeGreaterThan(0)
    expect(mockDs.offset[1]).toBe(0)
  })

  it('accounts for zoom level in offset changes', () => {
    controller.updatePointer(0, 300)
    controller.start()

    vi.advanceTimersByTime(16)
    const offsetAtScale1 = mockDs.offset[0]

    controller.stop()
    mockDs.offset[0] = 0
    mockDs.scale = 2

    controller.start()
    vi.advanceTimersByTime(16)
    const offsetAtScale2 = mockDs.offset[0]

    expect(offsetAtScale2).toBeCloseTo(offsetAtScale1 / 2)
  })

  it('stops panning when stop() is called', () => {
    controller.updatePointer(790, 300)
    controller.start()

    vi.advanceTimersByTime(16)
    const callCount = onPanMock.mock.calls.length
    expect(callCount).toBeGreaterThan(0)

    controller.stop()

    vi.advanceTimersByTime(16)
    expect(onPanMock).toHaveBeenCalledTimes(callCount)
  })
})
