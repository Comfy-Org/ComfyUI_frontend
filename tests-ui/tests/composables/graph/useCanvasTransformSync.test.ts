import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useCanvasTransformSync } from '@/composables/graph/useCanvasTransformSync'

import type { LGraphCanvas } from '../../../../src/lib/litegraph/src/litegraph'

// Mock LiteGraph canvas
const createMockCanvas = (): Partial<LGraphCanvas> => ({
  canvas: document.createElement('canvas'),
  ds: {
    offset: [0, 0],
    scale: 1
  } as any // Mock the DragAndScale type
})

describe('useCanvasTransformSync', () => {
  let mockCanvas: LGraphCanvas
  let syncFn: ReturnType<typeof vi.fn>
  let callbacks: {
    onStart: ReturnType<typeof vi.fn>
    onUpdate: ReturnType<typeof vi.fn>
    onStop: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mockCanvas = createMockCanvas() as LGraphCanvas
    syncFn = vi.fn()
    callbacks = {
      onStart: vi.fn(),
      onUpdate: vi.fn(),
      onStop: vi.fn()
    }

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(cb, 16) // Simulate 60fps
      return 1
    })
    global.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should auto-start sync when canvas is provided', async () => {
    const { isActive } = useCanvasTransformSync(mockCanvas, syncFn, callbacks)

    await nextTick()

    expect(isActive.value).toBe(true)
    expect(callbacks.onStart).toHaveBeenCalledOnce()
    expect(syncFn).toHaveBeenCalledWith(mockCanvas)
  })

  it('should not auto-start when autoStart is false', async () => {
    const { isActive } = useCanvasTransformSync(mockCanvas, syncFn, callbacks, {
      autoStart: false
    })

    await nextTick()

    expect(isActive.value).toBe(false)
    expect(callbacks.onStart).not.toHaveBeenCalled()
    expect(syncFn).not.toHaveBeenCalled()
  })

  it('should not start when canvas is null', async () => {
    const { isActive } = useCanvasTransformSync(null, syncFn, callbacks)

    await nextTick()

    expect(isActive.value).toBe(false)
    expect(callbacks.onStart).not.toHaveBeenCalled()
  })

  it('should manually start and stop sync', async () => {
    const { isActive, startSync, stopSync } = useCanvasTransformSync(
      mockCanvas,
      syncFn,
      callbacks,
      { autoStart: false }
    )

    // Start manually
    startSync()
    await nextTick()

    expect(isActive.value).toBe(true)
    expect(callbacks.onStart).toHaveBeenCalledOnce()

    // Stop manually
    stopSync()
    await nextTick()

    expect(isActive.value).toBe(false)
    expect(callbacks.onStop).toHaveBeenCalledOnce()
  })

  it('should call sync function on each frame', async () => {
    useCanvasTransformSync(mockCanvas, syncFn, callbacks)

    await nextTick()

    // Advance timers to trigger additional frames (initial call + 3 more = 4 total)
    vi.advanceTimersByTime(48) // 3 additional frames at 16ms each
    await nextTick()

    expect(syncFn).toHaveBeenCalledTimes(4) // Initial call + 3 timed calls
    expect(syncFn).toHaveBeenCalledWith(mockCanvas)
  })

  it('should provide timing information in onUpdate callback', async () => {
    // Mock performance.now to return predictable values
    const mockNow = vi.spyOn(performance, 'now')
    mockNow.mockReturnValueOnce(0).mockReturnValueOnce(5) // 5ms duration

    useCanvasTransformSync(mockCanvas, syncFn, callbacks)

    await nextTick()

    expect(callbacks.onUpdate).toHaveBeenCalledWith(5)
  })

  it('should handle sync function that throws errors', async () => {
    const errorSyncFn = vi.fn().mockImplementation(() => {
      throw new Error('Sync failed')
    })

    // Creating the composable should not throw
    expect(() => {
      useCanvasTransformSync(mockCanvas, errorSyncFn, callbacks)
    }).not.toThrow()

    await nextTick()

    // Even though sync function throws, the composable should handle it gracefully
    expect(errorSyncFn).toHaveBeenCalled()
    expect(callbacks.onStart).toHaveBeenCalled()
  })

  it('should not start if already active', async () => {
    const { startSync } = useCanvasTransformSync(mockCanvas, syncFn, callbacks)

    await nextTick()

    // Try to start again
    startSync()
    await nextTick()

    // Should only be called once from auto-start
    expect(callbacks.onStart).toHaveBeenCalledOnce()
  })

  it('should not stop if already inactive', async () => {
    const { stopSync } = useCanvasTransformSync(mockCanvas, syncFn, callbacks, {
      autoStart: false
    })

    // Try to stop when not started
    stopSync()
    await nextTick()

    expect(callbacks.onStop).not.toHaveBeenCalled()
  })

  it('should clean up on component unmount', async () => {
    const TestComponent = {
      setup() {
        const { isActive } = useCanvasTransformSync(
          mockCanvas,
          syncFn,
          callbacks
        )
        return { isActive }
      },
      template: '<div>{{ isActive }}</div>'
    }

    const wrapper = mount(TestComponent)
    await nextTick()

    expect(callbacks.onStart).toHaveBeenCalled()

    // Unmount component
    wrapper.unmount()
    await nextTick()

    expect(callbacks.onStop).toHaveBeenCalled()
    expect(global.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('should work without callbacks', async () => {
    const { isActive } = useCanvasTransformSync(mockCanvas, syncFn)

    await nextTick()

    expect(isActive.value).toBe(true)
    expect(syncFn).toHaveBeenCalledWith(mockCanvas)
  })

  it('should stop sync when canvas becomes null during sync', async () => {
    let currentCanvas: any = mockCanvas
    const dynamicSyncFn = vi.fn(() => {
      // Simulate canvas becoming null during sync
      currentCanvas = null
    })

    const { isActive } = useCanvasTransformSync(
      currentCanvas,
      dynamicSyncFn,
      callbacks
    )

    await nextTick()

    expect(isActive.value).toBe(true)

    // Advance time to trigger sync
    vi.advanceTimersByTime(16)
    await nextTick()

    // Should handle null canvas gracefully
    expect(dynamicSyncFn).toHaveBeenCalled()
  })

  it('should use cancelAnimationFrame when stopping', async () => {
    const { stopSync } = useCanvasTransformSync(mockCanvas, syncFn, callbacks)

    await nextTick()

    stopSync()

    expect(global.cancelAnimationFrame).toHaveBeenCalledWith(1)
  })
})
