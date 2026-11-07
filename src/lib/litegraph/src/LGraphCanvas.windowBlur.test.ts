import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

describe('LGraphCanvas window blur', () => {
  let canvas: LGraphCanvas

  beforeEach(() => {
    const canvasElement = document.createElement('canvas')
    canvasElement.width = 800
    canvasElement.height = 600
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {}
    })

    canvas = new LGraphCanvas(canvasElement, new LGraph(), {
      skip_render: true,
      skip_events: true
    })
  })

  afterEach(() => {
    canvas.pointer.finally?.()
  })

  function startLinkDrag() {
    canvas.linkConnector.state.connectingTo = 'output'
    canvas['_linkConnectorDrop']()
  }

  it('cancels an in-flight link drag when the window loses focus', () => {
    startLinkDrag()
    expect(canvas.linkConnector.isConnecting).toBe(true)

    canvas.processWindowBlur()

    expect(canvas.linkConnector.isConnecting).toBe(false)
  })

  it('does nothing when no link drag is active', () => {
    expect(canvas.linkConnector.isConnecting).toBe(false)

    canvas.processWindowBlur()

    expect(canvas.linkConnector.isConnecting).toBe(false)
  })
})
