import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@comfyorg/telemetry/reportError'
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
  const runNextFrame = () => {
    const frame = frames.shift()
    if (!frame) throw new Error('No frame was scheduled')
    frame(0)
  }
  return { requestAnimationFrame, runNextFrame, frames }
}

function createCanvas() {
  return new LGraphCanvas(createTestCanvasElement(), new LGraph(), {
    skip_events: true
  })
}

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

  it('recovers when a later frame draws successfully', () => {
    const { runNextFrame, frames } = captureFrames()
    const draw = vi
      .spyOn(LGraphCanvas.prototype, 'draw')
      .mockImplementation(() => {})
      .mockImplementationOnce(() => {
        throw new TypeError('transient')
      })
      .mockImplementationOnce(() => {
        throw new TypeError('transient')
      })

    const canvas = createCanvas()
    runNextFrame()
    runNextFrame()

    expect(draw).toHaveBeenCalledTimes(3)
    expect(canvas.is_rendering).toBe(true)
    expect(frames).toHaveLength(1)
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('stops, reports once more, and can restart when every frame throws', () => {
    const { runNextFrame, frames } = captureFrames()
    vi.spyOn(LGraphCanvas.prototype, 'draw').mockImplementation(() => {
      throw new TypeError('drawImage is patched')
    })

    const canvas = createCanvas()
    while (frames.length > 0) runNextFrame()

    expect(canvas.is_rendering).toBe(false)
    expect(
      vi.mocked(reportError).mock.calls.map(([, o]) => o.errorType)
    ).toEqual([
      'error_rendering_canvas_initial_frame',
      'error_rendering_canvas_stopped'
    ])

    vi.mocked(LGraphCanvas.prototype.draw).mockImplementation(() => {})
    canvas.startRendering()
    expect(canvas.is_rendering).toBe(true)
  })

  it('reports a failure that first happens on a later frame and keeps rendering', () => {
    const { runNextFrame, frames } = captureFrames()
    const drawFailure = new TypeError('later')
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

  it('resets the drawing context and redraws everything after a failed frame', () => {
    captureFrames()
    const ctx = createMockCanvasRenderingContext2D()
    vi.spyOn(LGraphCanvas.prototype, 'draw')
      .mockImplementation(() => {})
      .mockImplementationOnce(function (this: LGraphCanvas) {
        this.dirty_canvas = false
        this.dirty_bgcanvas = false
        throw new TypeError('mid-frame')
      })

    vi.stubGlobal('devicePixelRatio', 2)
    onTestFinished(() => {
      vi.unstubAllGlobals()
    })
    const canvas = new LGraphCanvas(
      createTestCanvasElement({ ctx }),
      new LGraph(),
      { skip_events: true }
    )

    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0)
    expect([canvas.dirty_canvas, canvas.dirty_bgcanvas]).toEqual([true, true])
  })

  it('stops after repeated failures even when idle frames succeed between them', () => {
    const { runNextFrame, frames } = captureFrames()
    const draw = vi.spyOn(LGraphCanvas.prototype, 'draw')
    draw.mockImplementation(function (this: LGraphCanvas) {
      if (this.dirty_canvas) throw new TypeError('dirty frames fail')
    })

    const canvas = createCanvas()
    for (let i = 0; i < 200 && frames.length > 0; i++) {
      canvas.dirty_canvas = canvas.dirty_bgcanvas = i % 2 === 0
      runNextFrame()
    }

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
