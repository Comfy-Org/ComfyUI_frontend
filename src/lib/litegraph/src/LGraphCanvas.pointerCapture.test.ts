/**
 * Tests for pointer capture release behavior in processMouseUp.
 *
 * Some Mac hardware (certain trackpads/mice) sends pointerup events with
 * isPrimary=false even for the primary pointer. Without a fix, the canvas
 * holds pointer capture indefinitely — making the entire UI unresponsive.
 *
 * @vitest-environment jsdom
 */
import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    querySlotAtPoint: vi.fn(),
    queryRerouteAtPoint: vi.fn(),
    queryLinkSegmentAtPoint: vi.fn(),
    getNodeLayoutRef: vi.fn(() => ({ value: null })),
    getSlotLayout: vi.fn(),
    setSource: vi.fn(),
    batchUpdateNodeBounds: vi.fn()
  }
}))

function createCanvas(graph: LGraph): {
  canvas: LGraphCanvas
  el: HTMLCanvasElement
  releasePointerCapture: ReturnType<typeof vi.fn>
  hasPointerCapture: ReturnType<typeof vi.fn>
} {
  const el = document.createElement('canvas')
  el.width = 800
  el.height = 600

  // Track captured pointer IDs
  const capturedPointers = new Set<number>()
  const setPointerCapture = vi
    .fn()
    .mockImplementation((id: number) => capturedPointers.add(id))
  const releasePointerCapture = vi
    .fn()
    .mockImplementation((id: number) => capturedPointers.delete(id))
  const hasPointerCapture = vi
    .fn()
    .mockImplementation((id: number) => capturedPointers.has(id))

  el.setPointerCapture = setPointerCapture
  el.releasePointerCapture = releasePointerCapture
  el.hasPointerCapture = hasPointerCapture

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
  } satisfies Partial<CanvasRenderingContext2D>

  el.getContext = vi
    .fn()
    .mockReturnValue(fromAny<CanvasRenderingContext2D, unknown>(ctx))
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  })

  const canvas = new LGraphCanvas(el, graph, { skip_render: true })
  return { canvas, el, releasePointerCapture, hasPointerCapture }
}

function makePointerEvent(
  type: string,
  init: Partial<PointerEventInit> & { isPrimary?: boolean }
): PointerEvent {
  // jsdom PointerEvent doesn't support isPrimary override in constructor,
  // so we patch it after creation
  const e = new PointerEvent(type, {
    pointerId: 1,
    button: 0,
    buttons: 1,
    clientX: 100,
    clientY: 100,
    bubbles: true,
    cancelable: true,
    ...init
  })
  if (init.isPrimary !== undefined) {
    Object.defineProperty(e, 'isPrimary', { value: init.isPrimary })
  }
  return e
}

describe('LGraphCanvas processMouseUp — pointer capture release', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let releasePointerCapture: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    graph = new LGraph()
    ;({ canvas, releasePointerCapture } = createCanvas(graph))
  })

  it('releases capture when a non-primary pointerup arrives with the captured pointerId', () => {
    // Simulate primary pointerdown to set up capture
    const downEvent = makePointerEvent('pointerdown', {
      pointerId: 1,
      isPrimary: true
    })
    canvas.processMouseDown(downEvent as unknown as CanvasPointerEvent)

    // Sanity: pointer.pointerId should now be set
    expect(canvas.pointer.pointerId).toBe(1)

    // Non-primary pointerup with matching pointerId (the Mac bug scenario)
    const upEvent = makePointerEvent('pointerup', {
      pointerId: 1,
      isPrimary: false,
      button: 0,
      buttons: 0
    })
    canvas.processMouseUp(upEvent)

    // Capture must be released — otherwise the canvas holds it forever
    expect(releasePointerCapture).toHaveBeenCalledWith(1)
    expect(canvas.pointer.pointerId).toBeUndefined()
  })

  it('does NOT release capture when a non-primary pointerup has a different pointerId', () => {
    // Simulate primary pointerdown capturing pointerId 1
    const downEvent = makePointerEvent('pointerdown', {
      pointerId: 1,
      isPrimary: true
    })
    canvas.processMouseDown(downEvent as unknown as CanvasPointerEvent)

    // Non-primary pointerup for a different pointer (e.g. pointerId 2)
    const upEvent = makePointerEvent('pointerup', {
      pointerId: 2,
      isPrimary: false,
      button: 0,
      buttons: 0
    })
    canvas.processMouseUp(upEvent)

    // Capture for pointerId 1 should still be held
    expect(canvas.pointer.pointerId).toBe(1)
  })

  it('processes normally when a primary pointerup arrives', () => {
    const downEvent = makePointerEvent('pointerdown', {
      pointerId: 1,
      isPrimary: true
    })
    canvas.processMouseDown(downEvent as unknown as CanvasPointerEvent)

    const upEvent = makePointerEvent('pointerup', {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: 0
    })
    canvas.processMouseUp(upEvent)

    // Normal pointerup releases capture via the standard path
    expect(releasePointerCapture).toHaveBeenCalledWith(1)
    expect(canvas.pointer.pointerId).toBeUndefined()
  })
})
