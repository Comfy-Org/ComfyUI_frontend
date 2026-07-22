import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    querySlotAtPoint: vi.fn(),
    queryRerouteAtPoint: vi.fn(),
    getNodeLayoutRef: vi.fn(() => ({ value: null })),
    getSlotLayout: vi.fn(),
    setSource: vi.fn(),
    batchUpdateNodeBounds: vi.fn()
  }
}))

function createHarness() {
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 800
  canvasElement.height = 600
  canvasElement.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  })

  const graph = new LGraph()
  const canvas = new LGraphCanvas(canvasElement, graph, { skip_render: true })

  const node = new LGraphNode('Test Node')
  node.pos = [100, 100]
  node.size = [150, 80]
  node.updateArea()
  graph.add(node)

  return { canvas, graph, node }
}

/** Click point well within the node body - avoids the collapse toggle and title bar. */
const fakeEvent = { canvasX: 175, canvasY: 140 } as CanvasPointerEvent

describe('LGraphCanvas selectOnly mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('still selects a node via the default click handler', () => {
    const { canvas, node } = createHarness()
    canvas.selectOnly = true

    canvas['_processNodeClick'](fakeEvent, false, node)
    canvas.pointer.onClick?.(fakeEvent)

    expect(node.selected).toBe(true)
    expect(canvas.selectedItems.has(node)).toBe(true)
  })

  it('does not fall through to slot/widget handling once a node click is processed', () => {
    const { canvas, node } = createHarness()
    canvas.selectOnly = true
    const collapseSpy = vi.spyOn(node, 'collapse')

    canvas['_processNodeClick'](fakeEvent, false, node)

    // Only the default select-on-click handler should be assigned - collapse
    // toggling is part of the branch selectOnly skips.
    canvas.pointer.onClick?.(fakeEvent)
    expect(collapseSpy).not.toHaveBeenCalled()
  })

  it('blocks dragging but still performs sticky-select, even with allow_dragnodes on', () => {
    const { canvas, node } = createHarness()
    canvas.allow_dragnodes = true
    canvas.selectOnly = true
    const posBefore = [...node.pos]

    canvas['_startDraggingItems'](node, canvas.pointer, true)

    expect(node.selected).toBe(true)
    expect(canvas.isDragging).toBe(false)
    expect(Array.from(node.pos)).toEqual(posBefore)
  })

  it('allows dragging to start when selectOnly is off (sanity check)', () => {
    const { canvas, node } = createHarness()
    canvas.allow_dragnodes = true
    canvas.selectOnly = false

    canvas['_startDraggingItems'](node, canvas.pointer, true)

    expect(canvas.isDragging).toBe(true)
  })
})
