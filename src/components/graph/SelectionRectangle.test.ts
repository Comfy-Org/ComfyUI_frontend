import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import SelectionRectangle from './SelectionRectangle.vue'

const rafCallbacks: Array<() => void> = []
vi.mock('@vueuse/core', () => ({
  useRafFn: (cb: () => void) => {
    rafCallbacks.push(cb)
    return { pause: vi.fn(), resume: vi.fn() }
  }
}))

const mockCanvas = ref<unknown>(null)
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    get canvas() {
      return mockCanvas.value
    }
  })
}))

function createPanelEl() {
  const panel = document.createElement('div')
  vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(
    fromPartial<DOMRect>({ left: 300, top: 0, right: 1000, bottom: 800 })
  )
  return panel
}

function dragRectangle(eDown: [number, number], eMove: [number, number]) {
  const canvasEl = document.createElement('canvas')
  vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue(
    fromPartial<DOMRect>({ left: 0, top: 0, right: 1000, bottom: 800 })
  )
  mockCanvas.value = {
    canvas: canvasEl,
    dragging_rectangle: true,
    pointer: {
      eDown: { safeOffsetX: eDown[0], safeOffsetY: eDown[1] },
      eMove: { safeOffsetX: eMove[0], safeOffsetY: eMove[1] }
    }
  }
  rafCallbacks[rafCallbacks.length - 1]()
}

describe('SelectionRectangle', () => {
  afterEach(() => {
    rafCallbacks.length = 0
    mockCanvas.value = null
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('clips the rectangle to the canvas panel when dragged over the sidebar', async () => {
    render(SelectionRectangle, { props: { panelEl: createPanelEl() } })

    dragRectangle([100, 100], [800, 400])
    await nextTick()

    const rect = screen.getByTestId('selection-rectangle')
    expect(rect.style.left).toBe('300px')
    expect(rect.style.top).toBe('100px')
    expect(rect.style.width).toBe('500px')
    expect(rect.style.height).toBe('300px')
  })

  it('leaves a rectangle within the panel unchanged', async () => {
    render(SelectionRectangle, { props: { panelEl: createPanelEl() } })

    dragRectangle([400, 100], [600, 300])
    await nextTick()

    const rect = screen.getByTestId('selection-rectangle')
    expect(rect.style.left).toBe('400px')
    expect(rect.style.top).toBe('100px')
    expect(rect.style.width).toBe('200px')
    expect(rect.style.height).toBe('200px')
  })

  it('normalizes and clips a rectangle dragged up-and-left', async () => {
    render(SelectionRectangle, { props: { panelEl: createPanelEl() } })

    dragRectangle([800, 400], [100, 100])
    await nextTick()

    const rect = screen.getByTestId('selection-rectangle')
    expect(rect.style.left).toBe('300px')
    expect(rect.style.top).toBe('100px')
    expect(rect.style.width).toBe('500px')
    expect(rect.style.height).toBe('300px')
  })

  it('renders unclamped edges when the canvas panel is absent', async () => {
    render(SelectionRectangle)

    dragRectangle([100, 100], [800, 400])
    await nextTick()

    const rect = screen.getByTestId('selection-rectangle')
    expect(rect.style.left).toBe('100px')
    expect(rect.style.width).toBe('700px')
  })
})
