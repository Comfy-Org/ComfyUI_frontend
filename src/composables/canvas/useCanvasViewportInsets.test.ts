import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCanvasViewportInsets } from './useCanvasViewportInsets'

describe('getCanvasViewportInsets', () => {
  let canvasEl: HTMLElement
  let panelEl: HTMLElement

  beforeEach(() => {
    canvasEl = document.createElement('div')
    canvasEl.id = 'graph-canvas'
    document.body.appendChild(canvasEl)

    panelEl = document.createElement('div')
    panelEl.classList.add('graph-canvas-panel')
    document.body.appendChild(panelEl)
  })

  afterEach(() => {
    canvasEl.remove()
    panelEl.remove()
    vi.restoreAllMocks()
  })

  it('returns empty object when canvas element is not found', () => {
    canvasEl.remove()
    expect(getCanvasViewportInsets()).toEqual({})
  })

  it('returns empty object when panel element is not found', () => {
    panelEl.remove()
    expect(getCanvasViewportInsets()).toEqual({})
  })

  it('returns empty object when rects are identical', () => {
    const rect = {
      left: 0,
      right: 1920,
      top: 0,
      bottom: 1080,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
      toJSON: () => {}
    }
    vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue(rect)
    vi.spyOn(panelEl, 'getBoundingClientRect').mockReturnValue(rect)

    expect(getCanvasViewportInsets()).toEqual({})
  })

  it('computes left/right insets from panel offset', () => {
    vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 1920,
      top: 0,
      bottom: 1080,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
      toJSON: () => {}
    })
    vi.spyOn(panelEl, 'getBoundingClientRect').mockReturnValue({
      left: 300,
      right: 1620,
      top: 0,
      bottom: 1080,
      width: 1320,
      height: 1080,
      x: 300,
      y: 0,
      toJSON: () => {}
    })

    const insets = getCanvasViewportInsets()
    expect(insets.left).toBe(300)
    expect(insets.right).toBe(300)
    expect(insets.top).toBe(0)
    expect(insets.bottom).toBe(0)
  })

  it('computes right-side-only inset for right panel', () => {
    vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 1920,
      top: 0,
      bottom: 1080,
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
      toJSON: () => {}
    })
    vi.spyOn(panelEl, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 1620,
      top: 0,
      bottom: 1080,
      width: 1620,
      height: 1080,
      x: 0,
      y: 0,
      toJSON: () => {}
    })

    const insets = getCanvasViewportInsets()
    expect(insets.left).toBe(0)
    expect(insets.right).toBe(300)
  })
})
