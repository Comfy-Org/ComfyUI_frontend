import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

describe('useCanvasViewportInsets', () => {
  let canvasEl: HTMLElement
  let panelEl: HTMLElement

  function mockRect(el: HTMLElement, rect: Partial<DOMRect>) {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect
    })
  }

  beforeEach(async () => {
    vi.resetModules()

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

  async function load() {
    const mod = await import('./useCanvasViewportInsets')
    return mod.useCanvasViewportInsets()
  }

  it('returns a singleton across calls', async () => {
    const { useCanvasViewportInsets } =
      await import('./useCanvasViewportInsets')
    expect(useCanvasViewportInsets()).toBe(useCanvasViewportInsets())
  })

  it('reports zero insets when canvas and panel are coincident', async () => {
    const rect = {
      left: 0,
      right: 1920,
      top: 0,
      bottom: 1080,
      width: 1920,
      height: 1080
    }
    mockRect(canvasEl, rect)
    mockRect(panelEl, rect)

    const insets = await load()
    await nextTick()
    expect(insets.value).toEqual({ left: 0, right: 0, top: 0, bottom: 0 })
  })

  it('computes left/right insets from a centered panel', async () => {
    mockRect(canvasEl, {
      left: 0,
      right: 1920,
      top: 0,
      bottom: 1080,
      width: 1920,
      height: 1080
    })
    mockRect(panelEl, {
      left: 300,
      right: 1620,
      top: 0,
      bottom: 1080,
      width: 1320,
      height: 1080,
      x: 300
    })

    const insets = await load()
    await nextTick()
    expect(insets.value).toMatchObject({
      left: 300,
      right: 300,
      top: 0,
      bottom: 0
    })
  })

  it('clamps negative differences to zero', async () => {
    mockRect(canvasEl, {
      left: 100,
      right: 1820,
      top: 50,
      bottom: 1030,
      width: 1720,
      height: 980,
      x: 100,
      y: 50
    })
    mockRect(panelEl, {
      left: 0,
      right: 1920,
      top: 0,
      bottom: 1080,
      width: 1920,
      height: 1080
    })

    const insets = await load()
    await nextTick()
    expect(insets.value).toEqual({ left: 0, right: 0, top: 0, bottom: 0 })
  })
})
