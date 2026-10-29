import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@comfyorg/telemetry/reportError'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'

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
    vi.spyOn(LGraphCanvas.prototype, 'draw').mockImplementationOnce(() => {
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
      .mockImplementationOnce(() => {
        throw new TypeError('first')
      })
      .mockImplementationOnce(() => {
        throw new TypeError('second')
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

  it('keeps scheduling frames when the first frame succeeds', () => {
    const { requestAnimationFrame } = captureFrames()
    vi.spyOn(LGraphCanvas.prototype, 'draw').mockImplementation(() => {})

    const canvas = createCanvas()

    expect(canvas.is_rendering).toBe(true)
    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })
})
