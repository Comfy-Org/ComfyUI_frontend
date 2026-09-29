import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { visibleCanvasViewport } from './visibleCanvasViewport'

function rect(left: number, right: number, height = 450, top = 0): DOMRect {
  return {
    left,
    right,
    top,
    bottom: top + height,
    width: right - left,
    height,
    x: left,
    y: top,
    toJSON: () => ({})
  }
}

function createCanvas(canvasRect: DOMRect): LGraphCanvas {
  const element = document.createElement('canvas')
  element.width = 1600
  element.height = 900
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(canvasRect)
  return { canvas: element, dpr: 2 } as LGraphCanvas
}

describe('visibleCanvasViewport', () => {
  afterEach(() => {
    document.querySelector('.graph-canvas-panel')?.remove()
  })

  it('uses the full CSS-pixel canvas when the panel is absent', () => {
    expect(visibleCanvasViewport(createCanvas(rect(0, 800)))).toEqual([
      0, 0, 800, 450
    ])
  })

  it('uses the canvas DPR when layout dimensions are unavailable', () => {
    expect(visibleCanvasViewport(createCanvas(rect(0, 0, 0)))).toEqual([
      0, 0, 800, 450
    ])
  })

  it('returns the panel span relative to the canvas', () => {
    const panel = document.createElement('div')
    panel.className = 'graph-canvas-panel'
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(rect(200, 700))
    document.body.appendChild(panel)

    expect(visibleCanvasViewport(createCanvas(rect(100, 900)))).toEqual([
      100, 0, 500, 450
    ])
  })

  it('accounts for top and bottom panels in the usable viewport', () => {
    const panel = document.createElement('div')
    panel.className = 'graph-canvas-panel'
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(
      rect(200, 700, 350, 50)
    )
    document.body.appendChild(panel)

    expect(visibleCanvasViewport(createCanvas(rect(100, 900)))).toEqual([
      100, 50, 500, 350
    ])
  })

  it('uses the full canvas when the panel does not overlap it', () => {
    const panel = document.createElement('div')
    panel.className = 'graph-canvas-panel'
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(rect(800, 1000))
    document.body.appendChild(panel)

    expect(visibleCanvasViewport(createCanvas(rect(0, 800)))).toEqual([
      0, 0, 800, 450
    ])
  })
})
