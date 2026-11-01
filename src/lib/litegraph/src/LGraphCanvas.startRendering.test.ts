import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement
} from '@/utils/__tests__/canvasTestUtils'

function captureFrames() {
  const frames: FrameRequestCallback[] = []
  const requestAnimationFrame = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
  function runNextFrame() {
    const frame = frames.shift()
    if (!frame) throw new Error('No frame was scheduled')
    frame(0)
  }
  function runFrames(count: number) {
    for (let i = 0; i < count; i++) runNextFrame()
  }
  function drainFrames(
    limit: number,
    beforeFrame: (index: number) => void = () => {}
  ) {
    for (let i = 0; i < limit && frames.length > 0; i++) {
      beforeFrame(i)
      runNextFrame()
    }
  }
  return {
    requestAnimationFrame,
    runNextFrame,
    runFrames,
    drainFrames,
    frames
  }
}

function createCanvas() {
  return new LGraphCanvas(createTestCanvasElement(), new LGraph(), {
    skip_events: true
  })
}

vi.mock(import('@/platform/telemetry/reportError'))

describe('LGraphCanvas.startRendering', () => {
  it('finishes constructing, reports, and keeps rendering when the first frame throws', () => {
    const { requestAnimationFrame } = captureFrames()
    const drawFailure = new TypeError('drawImage is patched')
    vi.spyOn(LGraphCanvas.prototype, 'draw')
      .mockImplementation(() => {})
      .mockImplementationOnce(() => {
        throw drawFailure
      })

    const canvas = createCanvas()

    expect(canvas.is_rendering).toBe(true)
    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      drawFailure,
      expect.objectContaining({
        errorType: 'error_rendering_canvas_initial_frame'
      })
    )
  })

  it('restarts the failure budget after a frame draws successfully', () => {
    const { runFrames, frames } = captureFrames()
    let calls = 0
    const draw = vi
      .spyOn(LGraphCanvas.prototype, 'draw')
      .mockImplementation(() => {
        calls++
        if (calls !== 60) throw new TypeError('transient')
      })

    const canvas = createCanvas()
    runFrames(118)

    expect(draw).toHaveBeenCalledTimes(119)
    expect(canvas.is_rendering).toBe(true)
    expect(frames).toHaveLength(1)
    expect(reportError).toHaveBeenCalledOnce()
  })

  it.for([
    { name: 'same type, different message', second: new TypeError('second') },
    { name: 'different type, same message', second: new RangeError('first') },
    { name: 'literal string matching an error key', second: 'TypeError:first' }
  ])('reports each distinct drawing failure once: $name', ({ second }) => {
    const { runFrames } = captureFrames()
    const first = new TypeError('first')
    vi.spyOn(LGraphCanvas.prototype, 'draw')
      .mockImplementation(() => {})
      .mockImplementationOnce(() => {
        throw first
      })
      .mockImplementationOnce(() => {
        throw first
      })
      .mockImplementationOnce(() => {
        throw second
      })

    createCanvas()
    runFrames(2)

    expect(
      vi
        .mocked(reportError)
        .mock.calls.map(([cause, options]) => [cause, options.errorType])
    ).toEqual([
      [first, 'error_rendering_canvas_initial_frame'],
      [second, 'error_rendering_canvas_frame']
    ])
  })

  it('stops after 60 consecutive failed frames, reports once more, and can restart', () => {
    const { runFrames, frames } = captureFrames()
    vi.spyOn(LGraphCanvas.prototype, 'draw').mockImplementation(() => {
      throw new TypeError('drawImage is patched')
    })

    const canvas = createCanvas()
    runFrames(58)

    expect(canvas.is_rendering).toBe(true)
    expect(frames).toHaveLength(1)

    runFrames(1)

    expect(canvas.is_rendering).toBe(false)
    expect(frames).toHaveLength(0)
    expect(
      vi.mocked(reportError).mock.calls.map(([, o]) => [o.errorType, o.context])
    ).toEqual([
      ['error_rendering_canvas_initial_frame', undefined],
      ['error_rendering_canvas_stopped', { failedFrames: 60 }]
    ])

    vi.mocked(LGraphCanvas.prototype.draw).mockImplementation(() => {})
    canvas.startRendering()
    expect(canvas.is_rendering).toBe(true)
  })

  it('reports a failure that first happens on a later frame and keeps rendering', () => {
    const { runNextFrame, frames } = captureFrames()
    const drawFailure: unknown = Object.assign(Object.create(null), {
      message: 'extension draw failed'
    })
    vi.spyOn(LGraphCanvas.prototype, 'draw')
      .mockImplementation(() => {})
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw drawFailure
      })

    const canvas = createCanvas()
    runNextFrame()

    expect(canvas.is_rendering).toBe(true)
    expect(frames).toHaveLength(1)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      drawFailure,
      expect.objectContaining({ errorType: 'error_rendering_canvas_frame' })
    )
  })

  it('resets every drawing context and redraws everything after a failed frame', () => {
    captureFrames()
    const ctx = createMockCanvasRenderingContext2D()
    const bgctx = createMockCanvasRenderingContext2D()
    const overlayCtx = createMockCanvasRenderingContext2D()
    vi.spyOn(LGraphCanvas.prototype, 'draw')
      .mockImplementation(() => {})
      .mockImplementationOnce(function (this: LGraphCanvas) {
        this.dirty_canvas = false
        this.dirty_bgcanvas = false
        throw new TypeError('mid-frame')
      })

    vi.stubGlobal('devicePixelRatio', 2)
    const canvas = new LGraphCanvas(
      createTestCanvasElement({ ctx }),
      new LGraph(),
      { skip_events: true, skip_render: true }
    )
    canvas.bgcanvas = createTestCanvasElement({ ctx: bgctx })
    canvas.overlayCanvas = createTestCanvasElement({ ctx: overlayCtx })
    const resetFront = vi.spyOn(canvas.canvas, 'width', 'set')
    const resetBackground = vi.spyOn(canvas.bgcanvas, 'width', 'set')
    const resetOverlay = vi.spyOn(canvas.overlayCanvas, 'width', 'set')

    canvas.startRendering()

    expect(resetFront).toHaveBeenCalledOnce()
    expect(resetBackground).toHaveBeenCalledOnce()
    expect(resetOverlay).toHaveBeenCalledOnce()
    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0)
    expect(bgctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0)
    expect(overlayCtx.setTransform).toHaveBeenLastCalledWith(1, 0, 0, 1, 0, 0)
    expect([canvas.dirty_canvas, canvas.dirty_bgcanvas]).toEqual([true, true])
  })

  it('stops after repeated failures even when idle frames succeed between them', () => {
    const { drainFrames } = captureFrames()
    const draw = vi.spyOn(LGraphCanvas.prototype, 'draw')
    draw.mockImplementation(function (this: LGraphCanvas) {
      if (this.dirty_canvas) throw new TypeError('dirty frames fail')
    })

    const canvas = createCanvas()
    drainFrames(200, (index) => {
      canvas.dirty_canvas = canvas.dirty_bgcanvas = index % 2 === 0
    })

    expect(canvas.is_rendering).toBe(false)
  })

  it('finishes constructing when scheduling the first frame throws', () => {
    const schedulerFailure = new TypeError('patched scheduler')
    vi.spyOn(LGraphCanvas.prototype, 'draw').mockImplementation(() => {})
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
      throw schedulerFailure
    })

    const canvas = createCanvas()

    expect(canvas.is_rendering).toBe(false)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      schedulerFailure,
      expect.objectContaining({
        errorType: 'error_rendering_canvas_initial_frame'
      })
    )
  })

  it('keeps scheduling frames when the first frame succeeds', () => {
    const { requestAnimationFrame } = captureFrames()
    vi.spyOn(LGraphCanvas.prototype, 'draw').mockImplementation(() => {})

    const canvas = createCanvas()

    expect(canvas.is_rendering).toBe(true)
    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })
})
