import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'
import { runCanvasFramePhase } from '@/lib/litegraph/src/canvas/canvasFrame'
import {
  AutoPanController,
  calculateEdgePanSpeed
} from '@/renderer/core/canvas/useAutoPan'

describe('calculateEdgePanSpeed', () => {
  const MAX = 15

  it('returns 0 when pointer is in the center', () => {
    expect(calculateEdgePanSpeed(500, 0, 1000, 1, MAX)).toBe(0)
  })

  it('returns negative speed near the left/top edge', () => {
    const speed = calculateEdgePanSpeed(10, 0, 1000, 1, MAX)
    expect(speed).toBeLessThan(0)
  })

  it('returns positive speed near the right/bottom edge', () => {
    const speed = calculateEdgePanSpeed(990, 0, 1000, 1, MAX)
    expect(speed).toBeGreaterThan(0)
  })

  it('returns max speed at the exact edge', () => {
    const speed = calculateEdgePanSpeed(0, 0, 1000, 1, MAX)
    expect(speed).toBe(-15)
  })

  it('returns 0 at exactly the threshold boundary', () => {
    const speed = calculateEdgePanSpeed(50, 0, 1000, 1, MAX)
    expect(speed).toBe(0)
  })

  it('scales speed linearly with edge proximity', () => {
    const halfwaySpeed = calculateEdgePanSpeed(25, 0, 1000, 1, MAX)
    const quarterSpeed = calculateEdgePanSpeed(37.5, 0, 1000, 1, MAX)

    expect(halfwaySpeed).toBeCloseTo(-15 * 0.5)
    expect(quarterSpeed).toBeCloseTo(-15 * 0.25)
  })

  it('divides speed by scale (zoom level)', () => {
    const speedAtScale1 = calculateEdgePanSpeed(0, 0, 1000, 1, MAX)
    const speedAtScale2 = calculateEdgePanSpeed(0, 0, 1000, 2, MAX)

    expect(speedAtScale2).toBe(speedAtScale1 / 2)
  })

  it('returns max speed when pointer is outside bounds', () => {
    expect(calculateEdgePanSpeed(-10, 0, 1000, 1, MAX)).toBe(-15)
    expect(calculateEdgePanSpeed(1010, 0, 1000, 1, MAX)).toBe(15)
  })

  it('returns 0 when maxPanSpeed is 0 (disabled)', () => {
    expect(calculateEdgePanSpeed(0, 0, 1000, 1, 0)).toBe(0)
    expect(calculateEdgePanSpeed(10, 0, 1000, 1, 0)).toBe(0)
  })

  it('uses custom maxPanSpeed', () => {
    const speed = calculateEdgePanSpeed(0, 0, 1000, 1, 30)
    expect(speed).toBe(-30)
  })
})

describe('AutoPanController', () => {
  let mockCanvas: LGraphCanvas
  let mockDs: DragAndScale
  let onPanMock: ReturnType<typeof vi.fn<(dx: number, dy: number) => void>>
  let controller: AutoPanController

  beforeEach(() => {
    mockCanvas = new LGraphCanvas(createTestCanvasElement(), new LGraph(), {
      skip_render: true,
      skip_events: true
    })
    vi.spyOn(mockCanvas.canvas, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 800, 600)
    )
    mockDs = mockCanvas.ds

    onPanMock = vi.fn<(dx: number, dy: number) => void>()
    controller = new AutoPanController({
      canvas: mockCanvas,
      maxPanSpeed: 15,
      onPan: onPanMock
    })
  })

  afterEach(() => {
    controller.stop()
  })

  it('does not pan when pointer is in the center', () => {
    controller.updatePointer(400, 300)
    controller.start()

    vi.advanceTimersByTime(16)
    runCanvasFramePhase(mockCanvas, 'update')

    expect(onPanMock).not.toHaveBeenCalled()
  })

  it('keeps panning against the replacement canvas bounds', () => {
    controller.updatePointer(790, 300)
    controller.start()

    const replacement = createTestCanvasElement()
    vi.spyOn(replacement, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 600, 600)
    )
    mockCanvas.setCanvas(replacement, true)
    vi.advanceTimersByTime(16)
    runCanvasFramePhase(mockCanvas, 'update')

    expect(mockDs.offset[0]).toBeCloseTo(-14.4)
    expect(mockDs.offset[1]).toBe(0)
  })

  it('pans when pointer is near the bottom edge', () => {
    controller.updatePointer(400, 590)
    controller.start()

    vi.advanceTimersByTime(16)
    runCanvasFramePhase(mockCanvas, 'update')

    expect(onPanMock).toHaveBeenCalled()
    const [dx, dy] = onPanMock.mock.calls[0]
    expect(dx).toBe(0)
    expect(dy).toBeGreaterThan(0)
  })

  it('pans diagonally when pointer is near a corner', () => {
    controller.updatePointer(790, 590)
    controller.start()

    vi.advanceTimersByTime(16)
    runCanvasFramePhase(mockCanvas, 'update')

    expect(onPanMock).toHaveBeenCalled()
    const [dx, dy] = onPanMock.mock.calls[0]
    expect(dx).toBeGreaterThan(0)
    expect(dy).toBeGreaterThan(0)
  })

  it.for([
    [10, 0, 9],
    [40, 0, 36],
    [500, 0, 45],
    [100, 100, 90],
    [200, 200, 180],
    [1000, 100, 90],
    [1000, 1000, 900],
    [2000, 1000, 900]
  ])(
    'pans %s ms at a %s ms frame interval by %s pixels, bounding stalls',
    ([elapsed, frameInterval, distance]) => {
      controller.updatePointer(0, 300)
      controller.start()

      vi.advanceTimersByTime(elapsed)
      runCanvasFramePhase(mockCanvas, 'update', frameInterval)

      expect(mockDs.offset[0]).toBeCloseTo(distance)
      expect(mockDs.offset[1]).toBe(0)
    }
  )

  it('accounts for zoom level in offset changes', () => {
    controller.updatePointer(0, 300)
    controller.start()

    vi.advanceTimersByTime(16)
    runCanvasFramePhase(mockCanvas, 'update')
    const offsetAtScale1 = mockDs.offset[0]

    controller.stop()
    mockDs.offset[0] = 0
    mockDs.scale = 2

    controller.start()
    vi.advanceTimersByTime(16)
    runCanvasFramePhase(mockCanvas, 'update')
    const offsetAtScale2 = mockDs.offset[0]

    expect(offsetAtScale2).toBeCloseTo(offsetAtScale1 / 2)
  })

  it('stops panning when stop() is called', () => {
    controller.updatePointer(790, 300)
    controller.start()

    vi.advanceTimersByTime(16)
    runCanvasFramePhase(mockCanvas, 'update')
    const callCount = onPanMock.mock.calls.length
    expect(callCount).toBeGreaterThan(0)

    controller.stop()

    vi.advanceTimersByTime(16)
    runCanvasFramePhase(mockCanvas, 'update')
    expect(onPanMock).toHaveBeenCalledTimes(callCount)
  })

  it('does not pan when maxPanSpeed is 0', () => {
    const disabledController = new AutoPanController({
      canvas: mockCanvas,
      maxPanSpeed: 0,
      onPan: onPanMock
    })

    disabledController.updatePointer(0, 0)
    disabledController.start()

    vi.advanceTimersByTime(16)
    runCanvasFramePhase(mockCanvas, 'update')

    expect(onPanMock).not.toHaveBeenCalled()
    disabledController.stop()
  })
})
