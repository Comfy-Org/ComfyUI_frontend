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

function createDragHarness() {
  const canvasElement = document.createElement('canvas')
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

  const graph = new LGraph()
  const canvas = new LGraphCanvas(canvasElement, graph, {
    skip_render: true,
    skip_events: true
  })

  const node = new LGraphNode('test')
  node.size = [200, 100]
  graph.add(node)

  const pointer = canvas.pointer
  const downEvent = new PointerEvent('pointerdown', {
    pointerId: 1,
    button: 0,
    buttons: 1
  })
  Object.assign(downEvent, {
    canvasX: 0,
    canvasY: 0,
    deltaX: 0,
    deltaY: 0,
    safeOffsetX: 0,
    safeOffsetY: 0
  })
  pointer.eDown = downEvent as typeof pointer.eDown

  return { canvas, canvasElement, graph, node, pointer }
}

describe('_startDraggingItems defers onSelectionChange', () => {
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement
  let node: LGraphNode
  let pointer: ReturnType<typeof createDragHarness>['pointer']

  beforeEach(() => {
    vi.useFakeTimers()
    ;({ canvas, canvasElement, node, pointer } = createDragHarness())
  })

  afterEach(() => {
    canvasElement.remove()
    vi.useRealTimers()
  })

  it('does not call onSelectionChange synchronously when an unselected node starts dragging', () => {
    const onSelectionChange = vi.fn()
    canvas.onSelectionChange = onSelectionChange

    canvas['_startDraggingItems'](node, pointer, true)

    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('calls onSelectionChange exactly once on the next animation frame', () => {
    const onSelectionChange = vi.fn()
    canvas.onSelectionChange = onSelectionChange

    canvas['_startDraggingItems'](node, pointer, true)
    expect(onSelectionChange).not.toHaveBeenCalled()

    vi.advanceTimersByTime(16)

    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    expect(onSelectionChange).toHaveBeenCalledWith(canvas.selected_nodes)
  })

  it('updates selection state synchronously even though the listener fires later', () => {
    canvas.onSelectionChange = vi.fn()

    expect(node.selected).toBeFalsy()
    canvas['_startDraggingItems'](node, pointer, true)

    expect(node.selected).toBe(true)
    expect(canvas.selected_nodes[node.id]).toBe(node)
    expect(canvas.isDragging).toBe(true)
  })

  it('restores onSelectionChange after processSelect so subsequent selection changes notify normally', () => {
    const onSelectionChange = vi.fn()
    canvas.onSelectionChange = onSelectionChange

    canvas['_startDraggingItems'](node, pointer, true)

    expect(canvas.onSelectionChange).toBe(onSelectionChange)
  })

  it('does not schedule a deferred notification when starting a drag on an already-selected sticky item', () => {
    canvas.select(node)
    const onSelectionChange = vi.fn()
    canvas.onSelectionChange = onSelectionChange

    canvas['_startDraggingItems'](node, pointer, true)

    vi.advanceTimersByTime(16)
    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('restores onSelectionChange even when processSelect throws', () => {
    const onSelectionChange = vi.fn()
    canvas.onSelectionChange = onSelectionChange
    const original = canvas.processSelect
    canvas.processSelect = () => {
      throw new Error('boom')
    }

    expect(() => canvas['_startDraggingItems'](node, pointer, true)).toThrow(
      'boom'
    )

    expect(canvas.onSelectionChange).toBe(onSelectionChange)
    canvas.processSelect = original
  })
})
