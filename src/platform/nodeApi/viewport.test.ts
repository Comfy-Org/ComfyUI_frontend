/**
 * The view-changed signal fires on pan/zoom and on resize, and chains rather
 * than replacing whoever already holds the hook.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { createViewportObserver, resetViewportObserver } from './viewport'

function fakeCanvas() {
  const ds: { scale: number; offset: number[]; onChanged?: () => void } = {
    scale: 1,
    offset: [0, 0]
  }
  return { ds } as unknown as LGraphCanvas
}

describe('viewport changes', () => {
  afterEach(() => {
    resetViewportObserver()
    LGraphCanvas.active_canvas = undefined as never
  })

  it('fires when the view pans or zooms', () => {
    const canvas = fakeCanvas()
    LGraphCanvas.active_canvas = canvas
    const seen = vi.fn()
    createViewportObserver()(seen)

    canvas.ds.onChanged?.(2, [10, 10])

    expect(seen).toHaveBeenCalled()
  })

  it('leaves an existing handler working', () => {
    // The canvas store holds this hook to track zoom. Replacing it would stop
    // the app's own scale readout updating.
    const canvas = fakeCanvas()
    const existing = vi.fn()
    canvas.ds.onChanged = existing
    LGraphCanvas.active_canvas = canvas
    const seen = vi.fn()
    createViewportObserver()(seen)

    canvas.ds.onChanged?.(2, [0, 0])

    expect(existing).toHaveBeenCalled()
    expect(seen).toHaveBeenCalled()
  })

  it('fires when the window resizes, which also moves the view', () => {
    LGraphCanvas.active_canvas = fakeCanvas()
    const seen = vi.fn()
    createViewportObserver()(seen)

    window.dispatchEvent(new Event('resize'))

    expect(seen).toHaveBeenCalled()
  })

  it('stops after unsubscribing', () => {
    const canvas = fakeCanvas()
    LGraphCanvas.active_canvas = canvas
    const seen = vi.fn()
    const stop = createViewportObserver()(seen)

    stop()
    canvas.ds.onChanged?.(2, [0, 0])
    window.dispatchEvent(new Event('resize'))

    expect(seen).not.toHaveBeenCalled()
  })

  it('subscribing before a canvas exists does not throw', () => {
    LGraphCanvas.active_canvas = undefined as never
    expect(() => createViewportObserver()(() => {})).not.toThrow()
  })
})
