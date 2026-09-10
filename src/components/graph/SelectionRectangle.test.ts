import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import type * as VueUse from '@vueuse/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import SelectionRectangle from './SelectionRectangle.vue'

const rafCallbacks: Array<() => void> = []
vi.mock<unknown>(import('@vueuse/core'), async (importOriginal) => ({
  ...(await importOriginal<typeof VueUse>()),
  useRafFn: (cb: () => void) => {
    rafCallbacks.push(cb)
    return { pause: vi.fn(), resume: vi.fn() }
  }
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
  useCanvasStore().canvas = fromPartial({
    canvas: canvasEl,
    dragging_rectangle: [
      eDown[0],
      eDown[1],
      eMove[0] - eDown[0],
      eMove[1] - eDown[1]
    ],
    pointer: {
      eDown: { safeOffsetX: eDown[0], safeOffsetY: eDown[1] },
      eMove: { safeOffsetX: eMove[0], safeOffsetY: eMove[1] }
    }
  })
  rafCallbacks[rafCallbacks.length - 1]()
}

describe('SelectionRectangle', () => {
  afterEach(() => {
    rafCallbacks.length = 0
    useCanvasStore().canvas = null
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
