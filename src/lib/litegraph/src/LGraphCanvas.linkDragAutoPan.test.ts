import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    querySlotAtPoint: vi.fn(),
    queryRerouteAtPoint: vi.fn(),
    getNodeLayoutRef: vi.fn(() => ({ value: null })),
    getSlotLayout: vi.fn()
  }
}))

describe('LGraphCanvas link drag auto-pan', () => {
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement

  beforeEach(() => {
    vi.useFakeTimers()

    canvasElement = document.createElement('canvas')
    canvasElement.width = 800
    canvasElement.height = 600

    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      roundRect: vi.fn(),
      getTransform: vi
        .fn()
        .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      textAlign: 'left' as CanvasTextAlign,
      textBaseline: 'alphabetic' as CanvasTextBaseline
    } as unknown as CanvasRenderingContext2D

    canvasElement.getContext = vi.fn().mockReturnValue(ctx)
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

    const graph = new LGraph()
    canvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true,
      skip_events: true
    })
  })

  afterEach(() => {
    canvas.pointer.finally?.()
    vi.useRealTimers()
  })

  function startLinkDrag() {
    canvas['_linkConnectorDrop']()
  }

  it('starts auto-pan when link drag begins', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    startLinkDrag()
    expect(canvas['_autoPan']).not.toBeNull()
  })

  it('keeps graph_mouse consistent with offset after auto-pan', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    startLinkDrag()

    vi.advanceTimersByTime(16)

    const { scale } = canvas.ds
    expect(canvas.graph_mouse[0]).toBeCloseTo(
      canvas.mouse[0] / scale - canvas.ds.offset[0]
    )
    expect(canvas.graph_mouse[1]).toBeCloseTo(
      canvas.mouse[1] / scale - canvas.ds.offset[1]
    )
  })

  it('keeps graph_mouse consistent with zoom applied', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    canvas.ds.scale = 2
    startLinkDrag()

    vi.advanceTimersByTime(16)

    expect(canvas.graph_mouse[0]).toBeCloseTo(
      canvas.mouse[0] / 2 - canvas.ds.offset[0]
    )
    expect(canvas.graph_mouse[1]).toBeCloseTo(
      canvas.mouse[1] / 2 - canvas.ds.offset[1]
    )
  })

  it('pans the viewport when pointer is near edge', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    startLinkDrag()

    const offsetBefore = canvas.ds.offset[0]

    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).not.toBe(offsetBefore)
  })

  it('marks canvas dirty when auto-pan fires', () => {
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
    startLinkDrag()

    canvas.dirty_canvas = false
    canvas.dirty_bgcanvas = false

    vi.advanceTimersByTime(16)

    expect(canvas.dirty_canvas).toBe(true)
    expect(canvas.dirty_bgcanvas).toBe(true)
  })

  it('stops auto-pan when pointer.finally fires', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    startLinkDrag()
    expect(canvas['_autoPan']).not.toBeNull()

    canvas.pointer.finally!()

    expect(canvas['_autoPan']).toBeNull()
  })

  it('does not pan when pointer is in the center', () => {
    canvas.mouse[0] = 400
    canvas.mouse[1] = 300
    startLinkDrag()

    const offsetBefore = [...canvas.ds.offset]

    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).toBe(offsetBefore[0])
    expect(canvas.ds.offset[1]).toBe(offsetBefore[1])
  })
})
