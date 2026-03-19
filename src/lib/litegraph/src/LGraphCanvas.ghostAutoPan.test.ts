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
  })

  afterEach(() => {
    canvasElement.remove()
    vi.useRealTimers()
  })

  it('starts auto-pan when ghost placement begins', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    canvas.startGhostPlacement(node)
    expect(canvas['_autoPan']).not.toBeNull()
  })

  it('pans the viewport when pointer is near edge during ghost placement', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    canvas.startGhostPlacement(node)

    const offsetBefore = canvas.ds.offset[0]

    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).not.toBe(offsetBefore)
  })

  it('moves the ghost node when auto-pan fires', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    canvas.startGhostPlacement(node)

    const posXBefore = node.pos[0]

    vi.advanceTimersByTime(16)

    expect(node.pos[0]).not.toBe(posXBefore)
  })

  it('does not pan when pointer is in the center', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    canvas.startGhostPlacement(node)

    const offsetBefore = [...canvas.ds.offset]

    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).toBe(offsetBefore[0])
    expect(canvas.ds.offset[1]).toBe(offsetBefore[1])
  })

  it('stops auto-pan when ghost placement is finalized', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    canvas.startGhostPlacement(node)
    expect(canvas['_autoPan']).not.toBeNull()

    canvas.finalizeGhostPlacement(false)

    expect(canvas['_autoPan']).toBeNull()
  })

  it('stops auto-pan when ghost placement is cancelled', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    canvas.startGhostPlacement(node)
    expect(canvas['_autoPan']).not.toBeNull()

    canvas.finalizeGhostPlacement(true)

    expect(canvas['_autoPan']).toBeNull()
  })

  it('marks canvas dirty when auto-pan fires', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    canvas.startGhostPlacement(node)

    canvas.dirty_canvas = false
    canvas.dirty_bgcanvas = false

    vi.advanceTimersByTime(16)

    expect(canvas.dirty_canvas).toBe(true)
    expect(canvas.dirty_bgcanvas).toBe(true)
  })

  it('removes document pointermove listener on finalize', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    canvas.startGhostPlacement(node)

    canvas.finalizeGhostPlacement(false)

    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('survives linkConnector reset during ghost placement', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    canvas.startGhostPlacement(node)
    expect(canvas['_autoPan']).not.toBeNull()

    canvas.linkConnector.reset()

    expect(canvas['_autoPan']).not.toBeNull()

    vi.advanceTimersByTime(16)
    expect(canvas.ds.offset[0]).not.toBe(0)
  })
})
