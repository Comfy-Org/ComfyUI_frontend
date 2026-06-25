import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useViewModeToggleStore } from '@/stores/viewModeToggleStore'

vi.mock('@/renderer/core/canvas/canvasStore', () => {
  const canvasStore = reactive({ linearMode: false })
  return { useCanvasStore: () => canvasStore }
})

let rafCallbacks: FrameRequestCallback[] = []

// The store lags via chained requestAnimationFrame, so drain the queue until
// the chain settles.
function flushFrames() {
  while (rafCallbacks.length) {
    const callbacks = rafCallbacks.splice(0)
    for (const callback of callbacks) callback(0)
  }
}

describe('useViewModeToggleStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    rafCallbacks = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    useCanvasStore().linearMode = false
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes the displayed mode to the current canvas mode', () => {
    useCanvasStore().linearMode = true

    const store = useViewModeToggleStore()

    expect(store.displayLinearMode).toBe(true)
  })

  it('defers the displayed mode change until the frame lag settles', async () => {
    const store = useViewModeToggleStore()
    expect(store.displayLinearMode).toBe(false)

    useCanvasStore().linearMode = true
    await nextTick()

    // The real mode flipped, but the displayed mode still lags so a freshly
    // mounted toggle renders the old order before animating to the new one.
    expect(store.displayLinearMode).toBe(false)

    flushFrames()

    expect(store.displayLinearMode).toBe(true)
  })
})
