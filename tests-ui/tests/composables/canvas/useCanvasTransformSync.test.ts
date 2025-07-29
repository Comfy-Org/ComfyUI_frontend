import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useCanvasTransformSync } from '@/composables/canvas/useCanvasTransformSync'

// Mock canvas store
let mockGetCanvas = vi.fn()
vi.mock('@/stores/graphStore', () => ({
  useCanvasStore: vi.fn(() => ({
    getCanvas: mockGetCanvas
  }))
}))

describe('useCanvasTransformSync', () => {
  let mockCanvas: { ds: { scale: number; offset: [number, number] } }
  let syncFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCanvas = {
      ds: {
        scale: 1,
        offset: [0, 0]
      }
    }
    syncFn = vi.fn()
    mockGetCanvas = vi.fn(() => mockCanvas)
    vi.clearAllMocks()
  })

  it('should not call syncFn when transform has not changed', async () => {
    const { startSync } = useCanvasTransformSync(syncFn, { autoStart: false })

    startSync()
    await nextTick()

    // Should call once initially
    expect(syncFn).toHaveBeenCalledTimes(1)

    // Wait for next RAF cycle
    await new Promise((resolve) => requestAnimationFrame(resolve))

    // Should not call again since transform didn't change
    expect(syncFn).toHaveBeenCalledTimes(1)
  })

  it('should call syncFn when scale changes', async () => {
    const { startSync } = useCanvasTransformSync(syncFn, { autoStart: false })

    startSync()
    await nextTick()

    expect(syncFn).toHaveBeenCalledTimes(1)

    // Change scale
    mockCanvas.ds.scale = 2

    // Wait for next RAF cycle
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(syncFn).toHaveBeenCalledTimes(2)
  })

  it('should call syncFn when offset changes', async () => {
    const { startSync } = useCanvasTransformSync(syncFn, { autoStart: false })

    startSync()
    await nextTick()

    expect(syncFn).toHaveBeenCalledTimes(1)

    // Change offset
    mockCanvas.ds.offset = [10, 20]

    // Wait for next RAF cycles
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(syncFn).toHaveBeenCalledTimes(2)
  })

  it('should stop calling syncFn after stopSync is called', async () => {
    const { startSync, stopSync } = useCanvasTransformSync(syncFn, {
      autoStart: false
    })

    startSync()
    await nextTick()

    expect(syncFn).toHaveBeenCalledTimes(1)

    stopSync()

    // Change transform after stopping
    mockCanvas.ds.scale = 2

    // Wait for RAF cycle
    await new Promise((resolve) => requestAnimationFrame(resolve))

    // Should not call again
    expect(syncFn).toHaveBeenCalledTimes(1)
  })

  it('should handle null canvas gracefully', async () => {
    mockGetCanvas.mockReturnValue(null)
    const { startSync } = useCanvasTransformSync(syncFn, { autoStart: false })

    startSync()
    await nextTick()

    // Should not call syncFn with null canvas
    expect(syncFn).not.toHaveBeenCalled()
  })

  it('should call onStart and onStop callbacks', () => {
    const onStart = vi.fn()
    const onStop = vi.fn()

    const { startSync, stopSync } = useCanvasTransformSync(syncFn, {
      autoStart: false,
      onStart,
      onStop
    })

    startSync()
    expect(onStart).toHaveBeenCalledTimes(1)

    stopSync()
    expect(onStop).toHaveBeenCalledTimes(1)
  })
})
