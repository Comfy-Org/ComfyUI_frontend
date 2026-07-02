import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

const mocks = vi.hoisted(() => {
  const canvas = {
    canvas: {},
    ds: {
      offset: [10, 20],
      scale: 2
    }
  } as unknown as LGraphCanvas

  return {
    bounds: {
      left: { value: 4 },
      top: { value: 6 }
    },
    canvas,
    getCanvas: vi.fn(() => canvas),
    update: vi.fn()
  }
})

vi.mock('@vueuse/core', () => ({
  useElementBounding: vi.fn(() => ({
    left: mocks.bounds.left,
    top: mocks.bounds.top,
    update: mocks.update
  }))
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: mocks.getCanvas
  })
}))

const { useCanvasPositionConversion, useSharedCanvasPositionConversion } =
  await import('./useCanvasPositionConversion')

describe('useCanvasPositionConversion', () => {
  beforeEach(() => {
    mocks.bounds.left.value = 4
    mocks.bounds.top.value = 6
    mocks.getCanvas.mockClear()
    mocks.update.mockClear()
  })

  it('converts client positions into canvas coordinates', () => {
    const { clientPosToCanvasPos } = useCanvasPositionConversion(
      mocks.canvas.canvas,
      mocks.canvas
    )

    expect(clientPosToCanvasPos([34, 66])).toEqual([5, 10])
  })

  it('converts canvas positions into client coordinates', () => {
    const { canvasPosToClientPos } = useCanvasPositionConversion(
      mocks.canvas.canvas,
      mocks.canvas
    )

    expect(canvasPosToClientPos([5, 10])).toEqual([34, 66])
  })

  it('returns the element bounds update callback', () => {
    const { update } = useCanvasPositionConversion(
      mocks.canvas.canvas,
      mocks.canvas
    )

    update()

    expect(mocks.update).toHaveBeenCalledTimes(1)
  })

  it('reuses the shared converter instance', () => {
    const first = useSharedCanvasPositionConversion()
    const second = useSharedCanvasPositionConversion()

    expect(second).toBe(first)
    expect(mocks.getCanvas).toHaveBeenCalledTimes(1)
  })
})
