import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

describe('LGraphCanvas link drag auto-pan', () => {
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement

  beforeEach(() => {
    vi.useFakeTimers()

    canvasElement = document.createElement('canvas')
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

    const graph = new LGraph()
    canvas = new LGraphCanvas(canvasElement, graph, {
      skip_render: true,
      skip_events: true
    })
  })

  afterEach(() => {
    canvas.pointer.finally?.()
  })

  function pressLink(clientX: number, clientY: number) {
    canvas.processMouseDown(
      new PointerEvent('pointerdown', {
        button: 0,
        buttons: 1,
        clientX,
        clientY,
        isPrimary: true
      })
    )
    canvas.linkConnector.state.connectingTo = 'output'
    canvas['_linkConnectorDrop']()
  }

  function movePointer(clientX: number, clientY: number) {
    canvas.processMouseMove(
      new PointerEvent('pointermove', {
        buttons: 1,
        clientX,
        clientY,
        isPrimary: true
      })
    )
  }

  function dragLinkTo(clientX: number, clientY: number) {
    pressLink(400, 300)
    movePointer(clientX, clientY)
  }

  function space(type: 'keydown' | 'keyup') {
    const event = new KeyboardEvent(type, { key: ' ' })
    Object.defineProperty(event, 'target', { value: canvasElement })
    canvas.processKey(event)
  }

  it('does not pan while a press near the edge stays within click drift', () => {
    pressLink(5, 300)
    const offsetBefore = [...canvas.ds.offset]

    vi.advanceTimersByTime(16)

    expect([...canvas.ds.offset]).toEqual(offsetBefore)
  })

  it('pans once a press near the edge drags past click drift', () => {
    pressLink(5, 300)
    movePointer(5, 340)
    const offsetBefore = [...canvas.ds.offset]

    vi.advanceTimersByTime(16)

    expect([...canvas.ds.offset]).not.toEqual(offsetBefore)
  })

  it('does not pan when Space is tapped during a still press near the edge', () => {
    pressLink(5, 300)
    space('keydown')
    space('keyup')
    const offsetBefore = [...canvas.ds.offset]

    vi.advanceTimersByTime(16)

    expect([...canvas.ds.offset]).toEqual(offsetBefore)
  })

  it.for([
    {
      name: 'a link drag',
      start: () => {
        dragLinkTo(5, 300)
        space('keydown')
      }
    },
    {
      name: 'a drag that starts while Space is held',
      start: () => {
        pressLink(5, 300)
        space('keydown')
        movePointer(5, 340)
      }
    }
  ])('auto-pans $name only once Space is released', ({ start }) => {
    start()
    const offsetWhileSpacePanning = [...canvas.ds.offset]

    vi.advanceTimersByTime(16)

    expect([...canvas.ds.offset]).toEqual(offsetWhileSpacePanning)

    space('keyup')
    vi.advanceTimersByTime(16)

    expect([...canvas.ds.offset]).not.toEqual(offsetWhileSpacePanning)
  })

  it('keeps graph_mouse consistent with offset after auto-pan', () => {
    dragLinkTo(5, 300)

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
    canvas.ds.scale = 2
    dragLinkTo(5, 300)

    vi.advanceTimersByTime(16)

    expect(canvas.graph_mouse[0]).toBeCloseTo(
      canvas.mouse[0] / 2 - canvas.ds.offset[0]
    )
    expect(canvas.graph_mouse[1]).toBeCloseTo(
      canvas.mouse[1] / 2 - canvas.ds.offset[1]
    )
  })

  it('pans the viewport when pointer is near edge', () => {
    dragLinkTo(5, 300)

    const offsetBefore = canvas.ds.offset[0]

    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).not.toBe(offsetBefore)
  })

  it('marks canvas dirty when auto-pan fires', () => {
    dragLinkTo(5, 300)

    canvas.dirty_canvas = false
    canvas.dirty_bgcanvas = false

    vi.advanceTimersByTime(16)

    expect(canvas.dirty_canvas).toBe(true)
    expect(canvas.dirty_bgcanvas).toBe(true)
  })

  it('stops auto-pan when pointer.finally fires', () => {
    pressLink(400, 300)
    expect(canvas['_autoPan']).not.toBeNull()

    canvas.pointer.finally!()

    expect(canvas['_autoPan']).toBeNull()
  })

  it('does not pan when pointer is in the center', () => {
    dragLinkTo(440, 300)

    const offsetBefore = [...canvas.ds.offset]

    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).toBe(offsetBefore[0])
    expect(canvas.ds.offset[1]).toBe(offsetBefore[1])
  })
})
