import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { visibleCanvasViewport } from './visibleCanvasViewport'

describe('visibleCanvasViewport', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('returns the graph panel bounds relative to the canvas', () => {
    vi.stubGlobal('devicePixelRatio', 1.5)
    const canvasElement = document.createElement('canvas')
    canvasElement.width = 2000
    canvasElement.height = 1400
    canvasElement.getBoundingClientRect = vi
      .fn()
      .mockReturnValue(new DOMRect(10, 20, 1000, 700))
    const graphPanel = document.createElement('div')
    graphPanel.className = 'graph-canvas-panel'
    graphPanel.getBoundingClientRect = vi
      .fn()
      .mockReturnValue(new DOMRect(260, 80, 700, 500))
    document.body.append(graphPanel)
    const canvas = {
      canvas: canvasElement
    } as LGraphCanvas

    expect(visibleCanvasViewport(canvas)).toEqual([250, 60, 700, 500])
  })

  it('uses the full canvas when the inset is empty', () => {
    const canvasElement = document.createElement('canvas')
    canvasElement.getBoundingClientRect = vi
      .fn()
      .mockReturnValue(new DOMRect(10, 20, 800, 450))

    expect(
      visibleCanvasViewport({ canvas: canvasElement } as LGraphCanvas, {})
    ).toEqual([0, 0, 800, 450])
  })

  it('subtracts the inset from the visible canvas', () => {
    const canvasElement = document.createElement('canvas')
    canvasElement.getBoundingClientRect = vi
      .fn()
      .mockReturnValue(new DOMRect(10, 20, 800, 450))

    expect(
      visibleCanvasViewport({ canvas: canvasElement } as LGraphCanvas, {
        top: 20,
        right: 200,
        bottom: 30,
        left: 40
      })
    ).toEqual([40, 20, 560, 400])
  })

  it('clamps negative and degenerate insets to the canvas bounds', () => {
    const canvasElement = document.createElement('canvas')
    canvasElement.getBoundingClientRect = vi
      .fn()
      .mockReturnValue(new DOMRect(10, 20, 800, 450))

    expect(
      visibleCanvasViewport({ canvas: canvasElement } as LGraphCanvas, {
        top: -20,
        right: -200,
        bottom: 500,
        left: 900
      })
    ).toEqual([800, 0, 0, 0])
  })
})
