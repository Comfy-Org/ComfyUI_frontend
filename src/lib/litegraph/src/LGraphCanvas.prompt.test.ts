import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  createMockCanvasPointerEvent,
  createMockCanvasRenderingContext2D
} from '@/utils/__tests__/litegraphTestUtils'

describe('LGraphCanvas.prompt', () => {
  it('appends the dialog beside its canvas without an active canvas', () => {
    Reflect.deleteProperty(LGraphCanvas, 'active_canvas')

    const parent = document.createElement('div')
    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    parent.append(canvasElement)

    const canvas = new LGraphCanvas(canvasElement, new LGraph(), {
      skip_render: true
    })
    const dialog = canvas.prompt(
      'Rename Slot',
      'slot',
      vi.fn(),
      createMockCanvasPointerEvent(0, 0, { clientX: 10, clientY: 20 })
    )

    expect(LGraphCanvas.active_canvas).toBeUndefined()
    expect(dialog.parentElement).toBe(parent)
  })
})
