import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDs, mockSetDirty } = vi.hoisted(() => {
  const mockDs = { offset: [0, 0] as number[], scale: 1 }
  const mockSetDirty = vi.fn()
  return { mockDs, mockSetDirty }
})

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      canvas: {
        getBoundingClientRect: () => ({
          left: 0,
          right: 800,
          top: 0,
          bottom: 600,
          width: 800,
          height: 600
        })
      },
      ds: mockDs,
      setDirty: mockSetDirty
    }
  }
}))

import { useAutoPan } from './useAutoPan'

describe('useAutoPan', () => {
  let rafCallbacks: Array<(timestamp: number) => void>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDs.offset = [0, 0]
    mockDs.scale = 1
    rafCallbacks = []

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb as (timestamp: number) => void)
      return rafCallbacks.length
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(performance, 'now').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not start panning when pointer is in the center', () => {
    const onPan = vi.fn()
    const { updatePointer } = useAutoPan(onPan)

    updatePointer(400, 300)

    expect(rafCallbacks).toHaveLength(0)
  })

  it('starts panning when pointer enters left edge zone', () => {
    const onPan = vi.fn()
    const { updatePointer } = useAutoPan(onPan)

    updatePointer(10, 300)

    expect(rafCallbacks).toHaveLength(1)
  })

  it('starts panning when pointer enters right edge zone', () => {
    const onPan = vi.fn()
    const { updatePointer } = useAutoPan(onPan)

    updatePointer(790, 300)

    expect(rafCallbacks).toHaveLength(1)
  })

  it('starts panning when pointer enters top edge zone', () => {
    const onPan = vi.fn()
    const { updatePointer } = useAutoPan(onPan)

    updatePointer(400, 10)

    expect(rafCallbacks).toHaveLength(1)
  })

  it('starts panning when pointer enters bottom edge zone', () => {
    const onPan = vi.fn()
    const { updatePointer } = useAutoPan(onPan)

    updatePointer(400, 590)

    expect(rafCallbacks).toHaveLength(1)
  })

  it('stops panning when stop() is called', () => {
    const onPan = vi.fn()
    const { updatePointer, stop } = useAutoPan(onPan)

    updatePointer(10, 300)
    expect(rafCallbacks).toHaveLength(1)

    stop()

    rafCallbacks[0](100)
    expect(onPan).not.toHaveBeenCalled()
  })

  it('calls onPan callback with canvas-space deltas', () => {
    const onPan = vi.fn()
    const { updatePointer } = useAutoPan(onPan)

    updatePointer(10, 300)
    expect(rafCallbacks).toHaveLength(1)

    rafCallbacks[0](100)

    expect(onPan).toHaveBeenCalledTimes(1)
    const [dx, dy] = onPan.mock.calls[0]
    expect(dx).toBeGreaterThan(0)
    expect(dy).toBe(0)
  })

  it('modifies ds.offset when panning', () => {
    const onPan = vi.fn()
    const { updatePointer } = useAutoPan(onPan)

    updatePointer(10, 300)
    rafCallbacks[0](100)

    expect(mockDs.offset[0]).toBeGreaterThan(0)
    expect(mockDs.offset[1]).toBe(0)
  })

  it('speed scales with proximity to edge', () => {
    const onPanClose = vi.fn()
    const controlsClose = useAutoPan(onPanClose)
    controlsClose.updatePointer(5, 300)
    rafCallbacks[0](100)
    controlsClose.stop()

    const dxClose = onPanClose.mock.calls[0][0]

    mockDs.offset = [0, 0]
    rafCallbacks = []

    const onPanFar = vi.fn()
    const controlsFar = useAutoPan(onPanFar)
    controlsFar.updatePointer(40, 300)
    rafCallbacks[0](100)
    controlsFar.stop()

    const dxFar = onPanFar.mock.calls[0][0]

    expect(Math.abs(dxClose)).toBeGreaterThan(Math.abs(dxFar))
  })

  it('marks canvas as dirty when panning', () => {
    const onPan = vi.fn()
    const { updatePointer } = useAutoPan(onPan)

    updatePointer(10, 300)
    rafCallbacks[0](100)

    expect(mockSetDirty).toHaveBeenCalledWith(true, true)
  })

  it('does not call onPan when velocity is zero', () => {
    const onPan = vi.fn()
    const { updatePointer } = useAutoPan(onPan)

    updatePointer(10, 300)

    updatePointer(400, 300)
    rafCallbacks[0](100)

    expect(onPan).not.toHaveBeenCalled()
  })
})
