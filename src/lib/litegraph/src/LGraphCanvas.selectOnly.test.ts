import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/layout/store/layoutStore')

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
  const firstNode = new LGraphNode('First Node')
  const secondNode = new LGraphNode('Second Node')
  firstNode.pos = [100, 100]
  firstNode.size = [150, 80]
  firstNode.updateArea()
  secondNode.pos = [400, 100]
  secondNode.size = [150, 80]
  secondNode.updateArea()
  graph.add(firstNode)
  graph.add(secondNode)
  canvas.visible_nodes = [firstNode, secondNode]

  return { canvas, graph, firstNode, secondNode }
}

describe('LGraphCanvas selectOnly', () => {
  beforeEach(() => {
    vi.mocked(layoutStore.getNodeLayout).mockReturnValue(null)
    vi.mocked(layoutStore.getNodeLayoutRef).mockReturnValue({
      value: null
    } as never)
    LiteGraph.vueNodesMode = false
    LiteGraph.middle_click_slot_add_default_node = false
  })

  it('accumulates ordinary node clicks and toggles a clicked node off', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    canvas.selectOnly = true

    canvas.processSelect(firstNode, undefined)
    canvas.processSelect(secondNode, undefined)

    expect(canvas.selectedItems).toEqual(new Set([firstNode, secondNode]))

    canvas.processSelect(firstNode, undefined)

    expect(canvas.selectedItems).toEqual(new Set([secondNode]))
    expect(firstNode.selected).toBe(false)
    expect(secondNode.selected).toBe(true)
  })

  it('preserves selected nodes when empty canvas space is clicked', () => {
    const { canvas, firstNode } = createHarness()
    canvas.selectOnly = true
    canvas.select(firstNode)

    canvas.processSelect(null, undefined)

    expect(canvas.selectedItems).toEqual(new Set([firstNode]))
    expect(firstNode.selected).toBe(true)
  })

  it('does not select non-node canvas items', () => {
    const { canvas } = createHarness()
    const group = new LGraphGroup('Group')
    canvas.selectOnly = true

    canvas.select(group)

    expect(canvas.selectedItems.has(group)).toBe(false)
    expect(group.selected).toBeFalsy()
  })

  it('keeps collapse clicks as node selection clicks', () => {
    const { canvas, firstNode } = createHarness()
    const event = { canvasX: 110, canvasY: 80 } as CanvasPointerEvent
    const collapseSpy = vi.spyOn(firstNode, 'collapse')
    canvas.selectOnly = true

    expect(firstNode.isPointInCollapse(event.canvasX, event.canvasY)).toBe(true)
    canvas['_processNodeClick'](event, false, firstNode)
    canvas.pointer.onClick?.(event)

    expect(collapseSpy).not.toHaveBeenCalled()
    expect(canvas.selectedItems).toEqual(new Set([firstNode]))
  })

  it('does not open a context menu on right click', () => {
    const { canvas, firstNode } = createHarness()
    canvas.selectOnly = true

    canvas.processMouseDown(
      new MouseEvent('pointerdown', {
        button: 2,
        clientX: 150,
        clientY: 140
      })
    )

    expect(canvas.pointer.onClick).toBeUndefined()
    expect(firstNode.selected).toBeFalsy()
  })

  it('does not open a context menu on double click', () => {
    const { canvas, firstNode } = createHarness()
    const event = new MouseEvent('pointerdown', {
      button: 0,
      clientX: 150,
      clientY: 140
    })
    Object.defineProperty(event, 'isPrimary', { value: true })
    canvas.pointer.isDown = true
    vi.spyOn(canvas.pointer, 'down').mockImplementation(() => {})
    canvas.selectOnly = true

    canvas.processMouseDown(event)

    expect(canvas.pointer.isDouble).toBe(true)
    expect(canvas.pointer.onClick).toBeUndefined()
    expect(firstNode.selected).toBeFalsy()
  })

  it('does not resize groups', () => {
    const { canvas, graph } = createHarness()
    const group = new LGraphGroup('Group')
    const event = { canvasX: 399, canvasY: 399 } as CanvasPointerEvent
    group._bounding.set([300, 300, 100, 100])
    graph.add(group)
    const resizeSpy = vi.spyOn(group, 'resize')
    canvas.selectOnly = true

    canvas['_processPrimaryButton'](event, undefined)
    canvas.pointer.onDrag?.({
      canvasX: 450,
      canvasY: 450
    } as CanvasPointerEvent)

    expect(canvas.pointer.onDrag).toBeDefined()
    expect(resizeSpy).not.toHaveBeenCalled()
  })

  it('does not create default nodes from middle-clicked slots', () => {
    const { canvas, firstNode } = createHarness()
    firstNode.addOutput('output', 'number')
    const [canvasX, canvasY] = firstNode.getOutputPos(0)
    LiteGraph.middle_click_slot_add_default_node = true
    canvas.selectOnly = true

    canvas['_processMiddleButton'](
      { canvasX, canvasY } as CanvasPointerEvent,
      firstNode
    )

    expect(canvas.pointer.onClick).toBeUndefined()
  })

  it('selects nodes without starting a drag', () => {
    const { canvas, firstNode } = createHarness()
    canvas.allow_dragnodes = true
    canvas.selectOnly = true

    canvas['_startDraggingItems'](firstNode, canvas.pointer, true)

    expect(canvas.selectedItems).toEqual(new Set([firstNode]))
    expect(canvas.isDragging).toBe(false)
  })

  it('does not start dragging groups', () => {
    const { canvas } = createHarness()
    const group = new LGraphGroup('Group')
    canvas.selectOnly = true

    canvas['_startDraggingItems'](group, canvas.pointer, true)

    expect(group.selected).toBeFalsy()
    expect(canvas.isDragging).toBe(false)
  })

  it('retains normal node dragging when disabled', () => {
    const { canvas, firstNode } = createHarness()
    canvas.allow_dragnodes = true

    canvas['_startDraggingItems'](firstNode, canvas.pointer, true)

    expect(canvas.isDragging).toBe(true)
  })

  it('retains the normal replace-and-clear selection behavior when disabled', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    const event = {} as CanvasPointerEvent

    canvas.processSelect(firstNode, event)
    canvas.processSelect(secondNode, event)

    expect(canvas.selectedItems).toEqual(new Set([secondNode]))

    canvas.processSelect(null, event)

    expect(canvas.selectedItems.size).toBe(0)
  })
})
