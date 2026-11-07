import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

describe('LGraphCanvas window blur', () => {
  let canvas: LGraphCanvas
  let canvasWindow: Window

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
    canvasWindow = canvas.getCanvasWindow()
  })

  afterEach(() => {
    canvas.unbindEvents()
    canvas.linkConnector.reset()
    canvas.pointer.finally?.()
  })

  function startLinkDrag() {
    canvas.linkConnector.state.connectingTo = 'output'
    canvas['_linkConnectorDrop']()
  }

  function dispatchWindowBlur() {
    canvasWindow.dispatchEvent(new Event('blur'))
  }

  it('cancels an in-flight link drag when the window loses focus', () => {
    canvas.bindEvents()
    startLinkDrag()
    expect(canvas.linkConnector.isConnecting).toBe(true)

    dispatchWindowBlur()

    expect(canvas.linkConnector.isConnecting).toBe(false)
  })

  it('stops cancelling once the canvas unbinds its events', () => {
    canvas.bindEvents()
    canvas.unbindEvents()
    startLinkDrag()

    dispatchWindowBlur()

    expect(canvas.linkConnector.isConnecting).toBe(true)
  })

  it('does nothing when no link drag is active', () => {
    const onReset = vi.fn()
    canvas.linkConnector.events.addEventListener('reset', onReset)
    canvas.bindEvents()

    dispatchWindowBlur()

    expect(onReset).not.toHaveBeenCalled()
    expect(canvas.linkConnector.isConnecting).toBe(false)
  })
})
