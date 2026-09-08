import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  createMockCanvasPointerEvent,
  createMockCanvasRenderingContext2D
} from '@/utils/__tests__/litegraphTestUtils'

function createCanvas(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> = {
    left: 0,
    top: 0,
    width: 800,
    height: 600
  }
) {
  const parent = document.createElement('div')
  const element = document.createElement('canvas')
  element.width = rect.width
  element.height = rect.height
  element.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  element.getBoundingClientRect = vi.fn().mockReturnValue(rect)
  parent.append(element)

  const canvas = new LGraphCanvas(element, new LGraph(), {
    skip_render: true
  })
  return { canvas, element, parent }
}

describe('LGraphCanvas.prompt', () => {
  it('appends the dialog beside its canvas without an active canvas', () => {
    Reflect.deleteProperty(LGraphCanvas, 'active_canvas')
    const { canvas, parent } = createCanvas()
    const dialog = canvas.prompt(
      'Rename Slot',
      'slot',
      vi.fn(),
      createMockCanvasPointerEvent(0, 0, { clientX: 10, clientY: 20 })
    )

    expect(LGraphCanvas.active_canvas).toBeUndefined()
    expect(dialog.parentElement).toBe(parent)
  })

  it('uses the invoked canvas when another canvas is active', () => {
    const owner = createCanvas({
      left: 100,
      top: 200,
      width: 800,
      height: 600
    })
    const active = createCanvas()
    owner.canvas.ds.scale = 2
    LGraphCanvas.active_canvas = active.canvas

    const dialog = owner.canvas.prompt(
      'Rename Slot',
      'slot',
      vi.fn(),
      createMockCanvasPointerEvent(0, 0, { clientX: 150, clientY: 260 })
    )

    expect(dialog.parentElement).toBe(owner.parent)
    expect(dialog.parentElement).not.toBe(active.parent)
    expect(dialog.style.transform).toBe('scale(2)')
    expect(dialog.style.left).toBe('30px')
    expect(dialog.style.top).toBe('40px')
  })

  it('closes only when the invoked canvas is clicked', () => {
    vi.useFakeTimers()
    const owner = createCanvas()
    const active = createCanvas()
    LGraphCanvas.active_canvas = active.canvas

    const dialog = owner.canvas.prompt(
      'Rename Slot',
      'slot',
      vi.fn(),
      createMockCanvasPointerEvent(0, 0)
    )
    vi.advanceTimersByTime(267)

    active.element.click()
    expect(dialog.parentElement).toBe(owner.parent)

    owner.element.click()
    expect(dialog.parentElement).toBeNull()
    vi.useRealTimers()
  })
})
