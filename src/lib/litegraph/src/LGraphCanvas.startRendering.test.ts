import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { createTestCanvasElement } from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/platform/telemetry/reportError'))

describe('LGraphCanvas.startRendering', () => {
  it('finishes constructing and reports when the first frame throws', () => {
    const drawFailure = new TypeError('drawImage is patched')
    vi.spyOn(LGraphCanvas.prototype, 'draw').mockImplementation(() => {
      throw drawFailure
    })

    const canvas = new LGraphCanvas(createTestCanvasElement(), new LGraph(), {
      skip_events: true
    })

    expect(canvas.is_rendering).toBe(false)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      drawFailure,
      expect.objectContaining({
        errorType: 'error_rendering_canvas_initial_frame'
      })
    )
  })

  it('keeps scheduling frames when the first frame succeeds', () => {
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockReturnValue(0)
    vi.spyOn(LGraphCanvas.prototype, 'draw').mockImplementation(() => {})

    const canvas = new LGraphCanvas(createTestCanvasElement(), new LGraph(), {
      skip_events: true
    })

    expect(canvas.is_rendering).toBe(true)
    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })
})
