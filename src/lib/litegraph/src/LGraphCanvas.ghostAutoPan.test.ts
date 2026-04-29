import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    querySlotAtPoint: vi.fn(),
    queryRerouteAtPoint: vi.fn(),
    getNodeLayoutRef: vi.fn(() => ({ value: null })),
    getSlotLayout: vi.fn(),
    setSource: vi.fn(),
    setActor: vi.fn()
  }
}))

describe('LGraphCanvas ghost placement auto-pan', () => {
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement
  let graph: LGraph
  let node: LGraphNode

  beforeEach(() => {
    vi.useFakeTimers()

    canvasElement = document.createElement('canvas')
    canvasElement.width = 800
    canvasElement.height = 600

    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    document.body.appendChild(canvasElement)
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

    node = new LGraphNode('test')
    node.size = [200, 100]
    graph.add(node)

    // Near left edge so autopan fires by default
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
  })

  afterEach(() => {
    canvasElement.remove()
    vi.useRealTimers()
  })

  it('moves the ghost node when pointer is near edge', () => {
    canvas.startGhostPlacement(node)

    const posXBefore = node.pos[0]
    vi.advanceTimersByTime(16)

    expect(node.pos[0]).not.toBe(posXBefore)
  })

  it('does not pan when pointer is in the center', () => {
    canvas.mouse[0] = 400
    canvas.startGhostPlacement(node)

    const offsetBefore = [...canvas.ds.offset]
    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).toBe(offsetBefore[0])
    expect(canvas.ds.offset[1]).toBe(offsetBefore[1])
  })

  it('cleans up autopan and document listener on finalize', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    canvas.startGhostPlacement(node)
    expect(canvas['_autoPan']).not.toBeNull()

    canvas.finalizeGhostPlacement(false)

    expect(canvas['_autoPan']).toBeNull()
    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('survives linkConnector reset during ghost placement', () => {
    canvas.startGhostPlacement(node)

    canvas.linkConnector.reset()

    expect(canvas['_autoPan']).not.toBeNull()
    vi.advanceTimersByTime(16)
    expect(canvas.ds.offset[0]).not.toBe(0)
  })
})
