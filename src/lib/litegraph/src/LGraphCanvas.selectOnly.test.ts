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
    LiteGraph.alt_drag_do_clone_nodes = false
    LiteGraph.leftMouseClickBehavior = 'panning'
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

    // The group's resize handle arms nothing: dragging_canvas is the
    // discriminator - the default empty-canvas behavior (panning here) took
    // over instead of the resize path.
    expect(canvas.dragging_canvas).toBe(true)
    expect(canvas.pointer.onDrag).toBeUndefined()
    expect(resizeSpy).not.toHaveBeenCalled()
  })

  it('keeps left-drag panning on empty canvas under the panning setting', () => {
    const { canvas, firstNode } = createHarness()
    canvas.select(firstNode)
    canvas.selectOnly = true
    const event = { canvasX: 700, canvasY: 500 } as CanvasPointerEvent

    canvas['_processPrimaryButton'](event, undefined)

    expect(canvas.dragging_canvas).toBe(true)
    expect(canvas.pointer.onDragStart).toBeUndefined()
    expect(canvas.pointer.onDoubleClick).toBeUndefined()

    // The pan-click selects nothing and picking preserves the selection.
    canvas.pointer.onClick?.(event)
    expect(canvas.selectedItems).toEqual(new Set([firstNode]))

    // Releasing the pan clears the drag flag.
    canvas.pointer.finally?.()
    expect(canvas.dragging_canvas).toBe(false)
  })

  it('arms the marquee under the select setting while picking', () => {
    const { canvas } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.selectOnly = true
    const event = { canvasX: 700, canvasY: 500 } as CanvasPointerEvent

    canvas['_processPrimaryButton'](event, undefined)

    // The select setting arms a selection drag, not a pan.
    expect(canvas.dragging_canvas).toBe(false)
    expect(canvas.pointer.onDragStart).toBeDefined()
    expect(canvas.pointer.onDoubleClick).toBeUndefined()

    canvas.pointer.onDragStart?.(canvas.pointer)
    expect(canvas.dragging_rectangle).not.toBeNull()
  })

  it('retains the replacing live-select when disabled', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.select(firstNode)

    canvas['handleLiveSelect'](
      {
        canvasX: 580,
        canvasY: 200,
        shiftKey: false,
        altKey: false
      } as CanvasPointerEvent,
      [380, 80, 0, 0],
      new Set([firstNode]),
      false
    )

    expect(canvas.selectedItems).toEqual(new Set([secondNode]))
  })

  it('a gesture that started while picking stays additive after the mode ends', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.select(firstNode)
    canvas.selectOnly = true
    const event = { canvasX: 380, canvasY: 80 } as CanvasPointerEvent

    canvas['_processPrimaryButton'](event, undefined)
    canvas.pointer.onDragStart?.(canvas.pointer)
    canvas.dragging_rectangle![2] = 200
    canvas.dragging_rectangle![3] = 120
    // The mode flips off mid-drag (the owner ends picking); the reconciler
    // runs on the gesture-start snapshot, so the picks survive.
    canvas.selectOnly = false
    canvas.pointer.onDragEnd?.({
      canvasX: 580,
      canvasY: 200,
      shiftKey: false,
      altKey: false
    } as CanvasPointerEvent)

    expect(canvas.selectedItems).toEqual(new Set([firstNode, secondNode]))
  })

  it('marquee-selects additively under the select setting while picking', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.select(firstNode)
    canvas.selectOnly = true

    // A marquee over ONLY the second node must not unpick the first.
    canvas['_handleMultiSelect'](
      { shiftKey: false, altKey: false } as CanvasPointerEvent,
      [380, 80, 200, 120],
      true
    )

    expect(canvas.selectedItems).toEqual(new Set([firstNode, secondNode]))
  })

  it('live-selects additively while picking', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.select(firstNode)
    canvas.selectOnly = true

    canvas['handleLiveSelect'](
      {
        canvasX: 580,
        canvasY: 200,
        shiftKey: false,
        altKey: false
      } as CanvasPointerEvent,
      [380, 80, 0, 0],
      new Set([firstNode]),
      true
    )

    expect(canvas.selectedItems).toEqual(new Set([firstNode, secondNode]))
  })

  it('retains the replacing marquee when disabled', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.select(firstNode)

    canvas['_handleMultiSelect'](
      { shiftKey: false, altKey: false } as CanvasPointerEvent,
      [380, 80, 200, 120],
      false
    )

    expect(canvas.selectedItems).toEqual(new Set([secondNode]))
  })

  it('selects the pressed node through the short-circuit click path', () => {
    const { canvas, firstNode } = createHarness()
    canvas.selectOnly = true
    const event = { canvasX: 150, canvasY: 140 } as CanvasPointerEvent

    canvas['_processPrimaryButton'](event, firstNode)
    canvas.pointer.onClick?.(event)

    // The counterfactual for the whole short-circuit: a bare `return` in its
    // body would leave the click unarmed and the node unselected.
    expect(canvas.selectedItems).toEqual(new Set([firstNode]))
  })

  it('does not clone nodes on alt-click', () => {
    const { canvas, graph, firstNode } = createHarness()
    LiteGraph.alt_drag_do_clone_nodes = true
    const cloneSpy = vi.spyOn(
      canvas as unknown as { _deserializeItems: (...args: never[]) => unknown },
      '_deserializeItems'
    )
    const event = {
      canvasX: 150,
      canvasY: 140,
      altKey: true,
      ctrlKey: false
    } as CanvasPointerEvent
    const nodeCountBefore = graph.nodes.length
    canvas.selectOnly = true

    canvas['_processPrimaryButton'](event, firstNode)

    expect(cloneSpy).not.toHaveBeenCalled()
    expect(graph.nodes.length).toBe(nodeCountBefore)
  })

  it('retains alt-click node cloning when disabled', () => {
    const { canvas, firstNode } = createHarness()
    LiteGraph.alt_drag_do_clone_nodes = true
    const cloneSpy = vi.spyOn(
      canvas as unknown as { _deserializeItems: (...args: never[]) => unknown },
      '_deserializeItems'
    )
    const event = {
      canvasX: 150,
      canvasY: 140,
      altKey: true,
      ctrlKey: false
    } as CanvasPointerEvent

    canvas['_processPrimaryButton'](event, firstNode)

    expect(cloneSpy).toHaveBeenCalledOnce()
  })

  it('does not insert reroutes on alt-click over a link', () => {
    const { canvas, graph } = createHarness()
    const linkSegment = {
      id: 1,
      path: {} as Path2D,
      _pos: [300, 300]
    } as unknown as Parameters<typeof canvas.renderedPaths.add>[0]
    canvas.renderedPaths.add(linkSegment)
    canvas.ctx.isPointInStroke = vi.fn().mockReturnValue(true)
    const createRerouteSpy = vi
      .spyOn(graph, 'createReroute')
      .mockReturnValue(null as never)
    const event = {
      canvasX: 300,
      canvasY: 300,
      altKey: true,
      shiftKey: false
    } as CanvasPointerEvent
    canvas.selectOnly = true

    canvas['_processPrimaryButton'](event, undefined)

    expect(createRerouteSpy).not.toHaveBeenCalled()
  })

  it('retains alt-click reroute insertion when disabled', () => {
    const { canvas, graph } = createHarness()
    const linkSegment = {
      id: 1,
      path: {} as Path2D,
      _pos: [300, 300]
    } as unknown as Parameters<typeof canvas.renderedPaths.add>[0]
    canvas.renderedPaths.add(linkSegment)
    canvas.ctx.isPointInStroke = vi.fn().mockReturnValue(true)
    const createRerouteSpy = vi
      .spyOn(graph, 'createReroute')
      .mockReturnValue(null as never)
    const event = {
      canvasX: 300,
      canvasY: 300,
      altKey: true,
      shiftKey: false
    } as CanvasPointerEvent

    canvas['_processPrimaryButton'](event, undefined)

    expect(createRerouteSpy).toHaveBeenCalledOnce()
  })

  it('does not open the link menu from the link marker', () => {
    const { canvas } = createHarness()
    const linkSegment = {
      id: 1,
      path: {} as Path2D,
      _pos: [300, 300]
    } as unknown as Parameters<typeof canvas.renderedPaths.add>[0]
    canvas.renderedPaths.add(linkSegment)
    canvas.ctx.isPointInStroke = vi.fn().mockReturnValue(false)
    const linkMenuSpy = vi
      .spyOn(canvas, 'showLinkMenu')
      .mockReturnValue(false as never)
    const event = { canvasX: 300, canvasY: 300 } as CanvasPointerEvent
    canvas.selectOnly = true

    canvas['_processPrimaryButton'](event, undefined)
    canvas.pointer.onClick?.(event)

    expect(linkMenuSpy).not.toHaveBeenCalled()
  })

  it('retains the link-marker menu when disabled', () => {
    const { canvas } = createHarness()
    const linkSegment = {
      id: 1,
      path: {} as Path2D,
      _pos: [300, 300]
    } as unknown as Parameters<typeof canvas.renderedPaths.add>[0]
    canvas.renderedPaths.add(linkSegment)
    canvas.ctx.isPointInStroke = vi.fn().mockReturnValue(false)
    const linkMenuSpy = vi
      .spyOn(canvas, 'showLinkMenu')
      .mockReturnValue(false as never)
    const event = { canvasX: 300, canvasY: 300 } as CanvasPointerEvent

    canvas['_processPrimaryButton'](event, undefined)
    canvas.pointer.onClick?.(event)

    expect(linkMenuSpy).toHaveBeenCalledOnce()
  })

  it('does not reorder nodes on a node click while picking', () => {
    const { canvas, firstNode } = createHarness()
    const bringToFrontSpy = vi.spyOn(canvas, 'bringToFront')
    const event = { canvasX: 150, canvasY: 140 } as CanvasPointerEvent
    canvas.selectOnly = true

    canvas['_processNodeClick'](event, false, firstNode)

    expect(bringToFrontSpy).not.toHaveBeenCalled()
  })

  it('retains bring-to-front on node click when disabled', () => {
    const { canvas, firstNode } = createHarness()
    const bringToFrontSpy = vi
      .spyOn(canvas, 'bringToFront')
      .mockImplementation(() => {})
    const event = { canvasX: 150, canvasY: 140 } as CanvasPointerEvent

    canvas['_processNodeClick'](event, false, firstNode)

    expect(bringToFrontSpy).toHaveBeenCalledOnce()
  })

  it('defence in depth: does not emit graph change events when picking starts on an item', () => {
    const { canvas, firstNode } = createHarness()
    const beforeChangeSpy = vi.spyOn(canvas, 'emitBeforeChange')
    canvas.selectOnly = true

    canvas['_startDraggingItems'](firstNode, canvas.pointer, true)

    expect(beforeChangeSpy).not.toHaveBeenCalled()
    expect(canvas.selectedItems).toEqual(new Set([firstNode]))
  })

  it('leaves node clicks to Vue nodes when vueNodesMode is on', () => {
    const { canvas, firstNode } = createHarness()
    LiteGraph.vueNodesMode = true
    canvas.selectOnly = true
    const event = { canvasX: 150, canvasY: 140 } as CanvasPointerEvent

    canvas['_processNodeClick'](event, false, firstNode)

    expect(canvas.pointer.onClick).toBeUndefined()
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

  it('a pan-armed click cannot wipe the picks after the mode ends', () => {
    const { canvas, firstNode } = createHarness()
    canvas.select(firstNode)
    canvas.selectOnly = true
    const event = { canvasX: 700, canvasY: 500 } as CanvasPointerEvent
    canvas['_processPrimaryButton'](event, undefined)

    // Mode flips off between pointerdown and a non-drag pointerup: the
    // armed click resolves on the gesture snapshot, not the live flag.
    canvas.selectOnly = false
    canvas.pointer.onClick?.(event)

    expect(canvas.selectedItems).toEqual(new Set([firstNode]))
  })

  it('a marquee-armed click cannot wipe the picks after the mode ends', () => {
    const { canvas, firstNode } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.select(firstNode)
    canvas.selectOnly = true
    const event = { canvasX: 700, canvasY: 500 } as CanvasPointerEvent
    canvas['_processPrimaryButton'](event, undefined)

    canvas.selectOnly = false
    canvas.pointer.onClick?.(event)

    expect(canvas.selectedItems).toEqual(new Set([firstNode]))
  })

  it('a node-armed click keeps picking additive after the mode ends', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    canvas.select(firstNode)
    canvas.selectOnly = true
    const event = { canvasX: 460, canvasY: 150 } as CanvasPointerEvent
    canvas['_processPrimaryButton'](event, secondNode)

    // The third gesture arm: a node press resolves its click on the
    // gesture snapshot too, so the flip cannot turn the pick replacing.
    canvas.selectOnly = false
    canvas.pointer.onClick?.(event)

    expect(canvas.selectedItems).toEqual(new Set([firstNode, secondNode]))
  })

  it('live-selects additively through the full gesture without churning', () => {
    const { canvas, graph, firstNode, secondNode } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.liveSelection = true
    const group = new LGraphGroup('Group')
    group._bounding.set([420, 120, 60, 40])
    graph.add(group)
    canvas.select(firstNode)
    canvas.selectOnly = true
    const changes = vi.fn()
    canvas.onSelectionChange = changes
    const press = { canvasX: 380, canvasY: 80 } as CanvasPointerEvent
    const move = {
      canvasX: 580,
      canvasY: 200,
      shiftKey: false,
      altKey: false
    } as CanvasPointerEvent

    canvas['_processPrimaryButton'](press, undefined)
    canvas.pointer.onDragStart?.(canvas.pointer)
    canvas.pointer.onDrag?.(move)

    // Additive through the live path; the group is refused by picking.
    expect(canvas.selectedItems).toEqual(new Set([firstNode, secondNode]))
    const callsAfterFirstMove = changes.mock.calls.length
    expect(callsAfterFirstMove).toBe(1)

    canvas.pointer.onDrag?.(move)

    // The refused group must not re-trigger selection-change every move.
    expect(changes.mock.calls.length).toBe(callsAfterFirstMove)
    expect(canvas.selectedItems).toEqual(new Set([firstNode, secondNode]))
  })

  it('retains replacing live selection through the full gesture when disabled', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.liveSelection = true
    canvas.select(firstNode)
    const press = { canvasX: 380, canvasY: 80 } as CanvasPointerEvent
    const move = {
      canvasX: 580,
      canvasY: 200,
      shiftKey: false,
      altKey: false
    } as CanvasPointerEvent

    canvas['_processPrimaryButton'](press, undefined)
    canvas.pointer.onDragStart?.(canvas.pointer)
    canvas.pointer.onDrag?.(move)

    expect(canvas.selectedItems).toEqual(new Set([secondNode]))
  })

  it('retains the replacing classic marquee through the full gesture when disabled', () => {
    const { canvas, firstNode, secondNode } = createHarness()
    LiteGraph.leftMouseClickBehavior = 'select'
    canvas.select(firstNode)
    const press = { canvasX: 380, canvasY: 80 } as CanvasPointerEvent

    canvas['_processPrimaryButton'](press, undefined)
    canvas.pointer.onDragStart?.(canvas.pointer)
    canvas.dragging_rectangle![2] = 200
    canvas.dragging_rectangle![3] = 120
    canvas.pointer.onDragEnd?.({
      canvasX: 580,
      canvasY: 200,
      shiftKey: false,
      altKey: false
    } as CanvasPointerEvent)

    expect(canvas.selectedItems).toEqual(new Set([secondNode]))
  })

  it('defence in depth: selects nodes without starting a drag', () => {
    const { canvas, firstNode } = createHarness()
    canvas.allow_dragnodes = true
    canvas.selectOnly = true

    canvas['_startDraggingItems'](firstNode, canvas.pointer, true)

    expect(canvas.selectedItems).toEqual(new Set([firstNode]))
    expect(canvas.isDragging).toBe(false)
  })

  it('defence in depth: does not start dragging groups', () => {
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
