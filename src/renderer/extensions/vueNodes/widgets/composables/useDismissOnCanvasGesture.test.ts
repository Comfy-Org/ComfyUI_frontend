import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

import { useDismissOnCanvasGesture } from './useDismissOnCanvasGesture'

function fakeCanvas(overrides: Partial<LGraphCanvas> = {}): LGraphCanvas {
  return {
    ds: { offset: [0, 0], scale: 1 },
    dragging_rectangle: null,
    ...overrides
  } as LGraphCanvas
}

function panCanvasTo(x: number, y: number) {
  useTransformState().syncWithCanvas(
    fakeCanvas({ ds: { offset: [x, y], scale: 1 } } as Partial<LGraphCanvas>)
  )
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

describe('useDismissOnCanvasGesture', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    panCanvasTo(0, 0)
  })

  function setup(active = ref(true)) {
    const onGesture = vi.fn()
    const scope = effectScope()
    scope.run(() => useDismissOnCanvasGesture(active, onGesture))
    return { onGesture, active, scope }
  }

  it('fires when the canvas viewport moves while active', async () => {
    const { onGesture, scope } = setup()

    panCanvasTo(120, 40)
    await nextTick()

    expect(onGesture).toHaveBeenCalled()
    scope.stop()
  })

  it('ignores viewport moves while inactive', async () => {
    const { onGesture, scope } = setup(ref(false))

    panCanvasTo(300, 0)
    await nextTick()

    expect(onGesture).not.toHaveBeenCalled()
    scope.stop()
  })

  it('fires when a box selection starts while active', async () => {
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fakeCanvas({
      dragging_rectangle: new Float64Array([0, 0, 10, 10])
    })
    const { onGesture, scope } = setup()

    await nextFrame()
    await nextFrame()

    expect(onGesture).toHaveBeenCalled()
    scope.stop()
  })

  it('does not poll for box selection while inactive', async () => {
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fakeCanvas({
      dragging_rectangle: new Float64Array([0, 0, 10, 10])
    })
    const { onGesture, scope } = setup(ref(false))

    await nextFrame()
    await nextFrame()

    expect(onGesture).not.toHaveBeenCalled()
    scope.stop()
  })
})
