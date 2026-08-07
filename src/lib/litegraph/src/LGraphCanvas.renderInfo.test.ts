import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'

describe('LGraphCanvas.renderInfo', () => {
  let lgCanvas: LGraphCanvas
  let ctx: CanvasRenderingContext2D
  let fillTextColors: CanvasFillStrokeStyles['fillStyle'][]

  beforeEach(() => {
    fillTextColors = []
    const canvasElement = document.createElement('canvas')
    ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      font: '',
      fillStyle: '',
      textAlign: 'left' as CanvasTextAlign,
      fillText: vi.fn()
    } as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D
    vi.mocked(ctx.fillText).mockImplementation(() => {
      fillTextColors.push(ctx.fillStyle)
    })

    canvasElement.getContext = vi.fn().mockReturnValue(ctx)

    const graph = new LGraph()
    lgCanvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true,
      skip_events: true
    })
  })

  it('does not access canvas.offsetHeight when y is provided', () => {
    const spy = vi.spyOn(lgCanvas.canvas, 'offsetHeight', 'get')

    lgCanvas.renderInfo(ctx, 10, 500)

    expect(spy).not.toHaveBeenCalled()
  })

  it('uses canvas.height divided by devicePixelRatio as y fallback', () => {
    lgCanvas.canvas.width = 1920
    lgCanvas.canvas.height = 2160

    const originalDPR = window.devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2,
      configurable: true
    })

    try {
      lgCanvas.renderInfo(ctx, 10, 0)

      // lineCount = 5 (graph present, no info_text), lineHeight = 13
      // y = canvas.height / DPR - (lineCount + 1) * lineHeight
      expect(ctx.translate).toHaveBeenCalledWith(10, 2160 / 2 - 6 * 13)
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', {
        value: originalDPR,
        configurable: true
      })
    }
  })

  it('renders additional info text in its configured color', () => {
    lgCanvas.info_text = 'Comfy Cloud'
    lgCanvas.info_text_color = '#f0ff41'

    lgCanvas.renderInfo(ctx, 10, 500)

    expect(ctx.fillText).toHaveBeenLastCalledWith('Comfy Cloud', 5, 78)
    expect(fillTextColors.at(-1)).toBe('#f0ff41')
  })

  it('renders additional info text in the fallback color', () => {
    lgCanvas.info_text = 'Comfy Cloud'

    lgCanvas.renderInfo(ctx, 10, 500)

    expect(ctx.fillText).toHaveBeenLastCalledWith('Comfy Cloud', 5, 78)
    expect(fillTextColors.at(-1)).toBe('#888')
  })
})
