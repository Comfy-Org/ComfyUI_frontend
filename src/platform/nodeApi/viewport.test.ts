/**
 * The view-changed signal fires on pan/zoom and on resize, and chains rather
 * than replacing whoever already holds the hook.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'
import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'

import { createViewportObserver, resetViewportObserver } from './viewport'

function createCanvas() {
  return new LGraphCanvas(createTestCanvasElement(), new LGraph(), {
    skip_events: true,
    skip_render: true
  })
}

describe('viewport changes', () => {
  afterEach(() => {
    resetViewportObserver()
    LGraphCanvas.active_canvas = undefined as never
  })

  it('fires when the view pans or zooms', () => {
    const canvas = createCanvas()
    LGraphCanvas.active_canvas = canvas
    const seen = vi.fn()
    createViewportObserver()(seen)

    canvas.ds.onChanged?.(2, [10, 10])

    expect(seen).toHaveBeenCalled()
  })

  it('leaves an existing handler working', () => {
    // The canvas store holds this hook to track zoom. Replacing it would stop
    // the app's own scale readout updating.
    const canvas = createCanvas()
    const existing = vi.fn()
    canvas.ds.onChanged = existing
    LGraphCanvas.active_canvas = canvas
    const seen = vi.fn()
    createViewportObserver()(seen)

    canvas.ds.onChanged(2, [0, 0])

    expect(existing).toHaveBeenCalled()
    expect(seen).toHaveBeenCalled()
  })

  it('fires when the window resizes, which also moves the view', () => {
    LGraphCanvas.active_canvas = createCanvas()
    const seen = vi.fn()
    createViewportObserver()(seen)

    window.dispatchEvent(new Event('resize'))

    expect(seen).toHaveBeenCalled()
  })

  it('stops after unsubscribing', () => {
    const canvas = createCanvas()
    LGraphCanvas.active_canvas = canvas
    const seen = vi.fn()
    const stop = createViewportObserver()(seen)

    stop()
    canvas.ds.onChanged?.(2, [0, 0])
    window.dispatchEvent(new Event('resize'))

    expect(seen).not.toHaveBeenCalled()
  })

  it('chains after a canvas appears', () => {
    LGraphCanvas.active_canvas = undefined as never
    const seen = vi.fn()
    createViewportObserver()(seen)
    const canvas = createCanvas()
    LGraphCanvas.active_canvas = canvas

    window.dispatchEvent(new Event('resize'))
    seen.mockClear()
    canvas.ds.onChanged?.(2, [0, 0])

    expect(seen).toHaveBeenCalledOnce()
  })

  it.for([
    {
      name: 'the view pans',
      act: (canvas: LGraphCanvas) => {
        canvas.ds.offset = [10, 0]
        canvas.ds.computeVisibleArea(undefined)
      }
    },
    {
      name: 'the window resizes',
      act: () => {
        window.dispatchEvent(new Event('resize'))
      }
    }
  ])(
    'still notifies later subscribers when an earlier one throws as $name',
    ({ act }) => {
      const canvas = createCanvas()
      LGraphCanvas.active_canvas = canvas
      const observe = createViewportObserver()
      const failure = new Error('pack listener failed')
      observe(() => {
        throw failure
      })
      const later = vi.fn()
      observe(later)

      act(canvas)

      expect(later).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
        errorType: 'node_api_viewport_listener_failure',
        surface: 'graph'
      })
    }
  )
})
