import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

describe('LGraphCanvas window blur', () => {
  let canvas: LGraphCanvas
  let graph: LGraph
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

    graph = new LGraph()
    canvas = new LGraphCanvas(canvasElement, graph, {
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
    const node = new LGraphNode('Source')
    const output = node.addOutput('value', 'number')
    node.updateArea()
    graph.add(node)
    canvas.linkConnector.dragNewFromOutput(graph, node, output)
  }

  function dispatchWindowBlur() {
    canvasWindow.dispatchEvent(new Event('blur'))
  }

  it('cancels an in-flight link drag when the window loses focus', () => {
    canvas.bindEvents()
    startLinkDrag()
    expect(canvas.linkConnector.isConnecting).toBe(true)
    expect(canvas.linkConnector.renderLinks).toHaveLength(1)

    dispatchWindowBlur()

    expect(canvas.linkConnector.isConnecting).toBe(false)
    expect(canvas.linkConnector.renderLinks).toHaveLength(0)
  })

  it('stops cancelling once the canvas unbinds its events', () => {
    canvas.bindEvents()
    canvas.unbindEvents()
    startLinkDrag()

    dispatchWindowBlur()

    expect(canvas.linkConnector.isConnecting).toBe(true)
    expect(canvas.linkConnector.renderLinks).toHaveLength(1)
  })

  it('does nothing when no link drag is active', () => {
    const onReset = vi.fn()
    canvas.linkConnector.events.addEventListener('reset', onReset)
    canvas.bindEvents()

    dispatchWindowBlur()

    expect(onReset).not.toHaveBeenCalled()
    expect(canvas.linkConnector.isConnecting).toBe(false)
    expect(canvas.linkConnector.renderLinks).toHaveLength(0)
  })
})
