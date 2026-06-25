import { effectScope, nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const canvasStore = reactive({ linearMode: false })
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasStore
}))

let rafCallbacks: FrameRequestCallback[] = []

// The composable lags via chained requestAnimationFrame, so drain the queue
// until the chain settles.
function flushFrames() {
  while (rafCallbacks.length) {
    const callbacks = rafCallbacks.splice(0)
    for (const callback of callbacks) callback(0)
  }
}

describe('useViewModeToggle', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    // Reset the module-level singleton so each test re-initializes from the
    // current mode, then discard any frames a prior test's watcher scheduled.
    vi.resetModules()
    canvasStore.linearMode = false
    rafCallbacks = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes the displayed mode to the current canvas mode', async () => {
    canvasStore.linearMode = true

    const { useViewModeToggle } =
      await import('@/composables/useViewModeToggle')

    expect(useViewModeToggle().displayLinearMode.value).toBe(true)
  })

  it('defers the displayed mode change until the frame lag settles', async () => {
    const { useViewModeToggle } =
      await import('@/composables/useViewModeToggle')
    const { displayLinearMode } = useViewModeToggle()
    expect(displayLinearMode.value).toBe(false)

    canvasStore.linearMode = true
    await nextTick()

    // The real mode flipped, but the displayed mode still lags so a toggle that
    // mounts now renders the old order before animating to the new one.
    expect(displayLinearMode.value).toBe(false)

    flushFrames()

    expect(displayLinearMode.value).toBe(true)
  })

  it('shares one lagged value across calls so a remount keeps animating', async () => {
    const { useViewModeToggle } =
      await import('@/composables/useViewModeToggle')
    const first = useViewModeToggle()

    canvasStore.linearMode = true

    // A second consumer (the toggle remounting in the other mode) reads the same
    // not-yet-settled value rather than the already-flipped canvas mode.
    const second = useViewModeToggle()
    expect(second.displayLinearMode).toBe(first.displayLinearMode)
    expect(second.displayLinearMode.value).toBe(false)

    await nextTick()
    flushFrames()

    expect(second.displayLinearMode.value).toBe(true)
  })

  it('keeps tracking the mode after the first caller is disposed', async () => {
    const { useViewModeToggle } =
      await import('@/composables/useViewModeToggle')

    // Simulate the component that first reads the value (e.g. the graph-mode
    // toggle) mounting and then unmounting on a mode switch. The watcher must
    // outlive that scope so later switches still propagate.
    const scope = effectScope()
    const { displayLinearMode } = scope.run(() => useViewModeToggle())!
    scope.stop()

    canvasStore.linearMode = true
    await nextTick()
    flushFrames()

    expect(displayLinearMode.value).toBe(true)
  })
})
