import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Positionable, Rect } from '@/lib/litegraph/src/interfaces'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { selectableKeyOf } from '@/lib/litegraph/src/utils/selectableItems'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    querySlotAtPoint: vi.fn(),
    queryRerouteAtPoint: vi.fn(),
    queryLinkSegmentAtPoint: vi.fn(),
    getNodeLayoutRef: vi.fn(() => ({ value: null })),
    getNodeLayout: vi.fn(),
    getSlotLayout: vi.fn(),
    setSource: vi.fn(),
    batchUpdateNodeBounds: vi.fn(),
    applyOperation: vi.fn(),
    allocateZIndex: vi.fn(() => 0),
    readNodeRect: vi.fn(() => false),
    contentSizeOf: vi.fn(),
    getGroupLayout: vi.fn()
  }
}))

type Modifiers = Partial<
  Pick<MouseEventInit, 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>
>

function createCanvas(graph: LGraph): LGraphCanvas {
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
  document.body.append(canvasElement)
  return new LGraphCanvas(canvasElement, graph, { skip_render: true })
}

function addNode(graph: LGraph, title: string, x: number, y: number) {
  const node = new LGraphNode(title)
  node.pos = [x, y]
  node.size = [100, 60]
  node.updateArea()
  graph.add(node)
  return node
}

function addGroup(graph: LGraph, title: string, bounds: Rect) {
  const group = new LGraphGroup(title)
  group._bounding.set(bounds)
  graph.add(group)
  return group
}

function pointerEvent(
  type: 'pointerdown' | 'pointerup',
  x: number,
  y: number,
  modifiers: Modifiers
): PointerEvent {
  const event = new MouseEvent(type, {
    button: 0,
    buttons: type === 'pointerdown' ? 1 : 0,
    clientX: x,
    clientY: y,
    ...modifiers
  })
  Object.defineProperty(event, 'isPrimary', { value: true })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event as PointerEvent
}

function click(
  canvas: LGraphCanvas,
  x: number,
  y: number,
  modifiers: Modifiers = {}
) {
  canvas.visible_nodes = [...canvas.graph!.nodes]
  canvas.processMouseDown(pointerEvent('pointerdown', x, y, modifiers))
  canvas.processMouseUp(pointerEvent('pointerup', x, y, modifiers))
}

function marquee(
  canvas: LGraphCanvas,
  from: [number, number],
  to: [number, number],
  modifiers: Modifiers
) {
  const initialSelection = new Set<Positionable>(canvas.selectedItems)
  const dragRect: Rect = [from[0], from[1], to[0] - from[0], to[1] - from[1]]
  const event = {
    canvasX: to[0],
    canvasY: to[1],
    ...modifiers
  } as CanvasPointerEvent
  if (canvas.liveSelection) {
    canvas['handleLiveSelect'](event, dragRect, initialSelection)
  } else {
    canvas['_handleMultiSelect'](event, dragRect)
  }
}

function keyEvent(type: 'keydown' | 'keyup', key: string): KeyboardEvent {
  const event = new KeyboardEvent(type, { key })
  Object.defineProperty(event, 'target', { value: { localName: 'div' } })
  return event
}

function selectedTitles(canvas: LGraphCanvas): string[] {
  return [...canvas.selectedItems]
    .map((item) => ('title' in item ? String(item.title) : String(item)))
    .sort()
}

describe('LGraphCanvas selection', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let a: LGraphNode
  let b: LGraphNode
  let onSelectionChange: NonNullable<LGraphCanvas['onSelectionChange']>

  beforeEach(() => {
    LiteGraph.vueNodesMode = false
    graph = new LGraph()
    canvas = createCanvas(graph)
    a = addNode(graph, 'A', 20, 40)
    b = addNode(graph, 'B', 300, 40)
    onSelectionChange = vi.fn()
    canvas.onSelectionChange = onSelectionChange
  })

  afterEach(() => {
    expect(useSelectionStore().selectedKeys(graphScopeOf(graph))).toEqual(
      [...canvas.selectedItems].map(selectableKeyOf)
    )
  })

  describe('click', () => {
    it.for<{ name: string; modifiers: Modifiers; expected: string[] }>([
      { name: 'plain click replaces', modifiers: {}, expected: ['B'] },
      {
        name: 'shift click adds',
        modifiers: { shiftKey: true },
        expected: ['A', 'B']
      },
      {
        name: 'ctrl click adds',
        modifiers: { ctrlKey: true },
        expected: ['A', 'B']
      },
      {
        name: 'meta click adds',
        modifiers: { metaKey: true },
        expected: ['A', 'B']
      }
    ])('$name', ({ modifiers, expected }) => {
      click(canvas, 60, 60)
      click(canvas, 340, 60, modifiers)

      expect(selectedTitles(canvas)).toEqual(expected)
    })

    it.fails('a replacing click reports one change', () => {
      click(canvas, 60, 60)
      click(canvas, 340, 60)

      expect(onSelectionChange).toHaveBeenCalledTimes(2)
    })

    it('ctrl click on a selected item removes it', () => {
      click(canvas, 60, 60)
      click(canvas, 340, 60, { ctrlKey: true })
      click(canvas, 60, 60, { ctrlKey: true })

      expect(selectedTitles(canvas)).toEqual(['B'])
      expect(a.selected).toBe(false)
    })

    it('plain click on empty canvas clears', () => {
      click(canvas, 60, 60)
      click(canvas, 600, 500)

      expect(canvas.selectedItems.size).toBe(0)
      expect(a.selected).toBe(false)
    })

    it.fails('a clearing click reports one change', () => {
      click(canvas, 60, 60)
      click(canvas, 600, 500)

      expect(onSelectionChange).toHaveBeenCalledTimes(2)
    })

    it('modifier click on empty canvas keeps the selection', () => {
      click(canvas, 60, 60)
      click(canvas, 600, 500, { shiftKey: true })

      expect(selectedTitles(canvas)).toEqual(['A'])
    })

    it('click on a group title selects the group only', () => {
      const group = addGroup(graph, 'G', [0, 0, 500, 300])

      click(canvas, 250, 10)

      expect(selectedTitles(canvas)).toEqual(['G'])
      expect(group.selected).toBe(true)
      expect(a.selected).toBeFalsy()
    })

    it('click on a node inside a group selects the node only', () => {
      addGroup(graph, 'G', [0, 0, 500, 300])

      click(canvas, 60, 60)

      expect(selectedTitles(canvas)).toEqual(['A'])
    })

    it('keeps item flags, selected_nodes and highlighted links aligned', () => {
      a.addOutput('out', 'number')
      b.addInput('in', 'number')
      a.connect(0, b, 0)

      click(canvas, 60, 60)
      click(canvas, 340, 60, { shiftKey: true })
      expect(Object.keys(canvas.highlighted_links)).toHaveLength(1)
      expect(Object.keys(canvas.selected_nodes)).toHaveLength(2)

      click(canvas, 600, 500)
      expect(Object.keys(canvas.highlighted_links)).toHaveLength(0)
      expect(Object.keys(canvas.selected_nodes)).toHaveLength(0)
      expect(a.selected).toBe(false)
      expect(b.selected).toBe(false)
    })
  })

  describe('programmatic API', () => {
    it.fails('select() reports the change', () => {
      canvas.select(a)

      expect(onSelectionChange).toHaveBeenCalledTimes(1)
    })

    it.fails('deselect() reports the change', () => {
      canvas.select(a)
      canvas.deselect(a)

      expect(onSelectionChange).toHaveBeenCalledTimes(2)
    })

    it('deleteSelected() empties the selection', () => {
      canvas.select(a)
      canvas.select(b)

      canvas.deleteSelected()

      expect(canvas.selectedItems.size).toBe(0)
      expect(graph.nodes).toHaveLength(0)
    })

    it('setGraph() clears the selection of the graph being left', () => {
      canvas.select(a)
      const scope = graphScopeOf(graph)

      canvas.setGraph(new LGraph())

      expect(useSelectionStore().selectedKeys(scope)).toEqual([])
      expect(a.selected).toBeFalsy()
    })

    it('deselectAll() reports only when something was selected', () => {
      canvas.deselectAll()
      expect(onSelectionChange).not.toHaveBeenCalled()

      canvas.select(a)
      canvas.deselectAll()
      expect(onSelectionChange).toHaveBeenCalledTimes(1)
      expect(a.selected).toBe(false)
    })
  })

  describe('marquee', () => {
    beforeEach(() => {
      addNode(graph, 'C', 300, 300)
    })

    describe.for([{ liveSelection: false }, { liveSelection: true }])(
      'liveSelection=$liveSelection',
      ({ liveSelection }) => {
        beforeEach(() => {
          canvas.liveSelection = liveSelection
        })

        it('plain marquee replaces the selection', () => {
          click(canvas, 60, 60)

          marquee(canvas, [250, 0], [450, 400], {})

          expect(selectedTitles(canvas)).toEqual(['B', 'C'])
          expect(a.selected).toBe(false)
        })

        it('shift marquee adds to the selection', () => {
          click(canvas, 60, 60)

          marquee(canvas, [250, 0], [450, 400], { shiftKey: true })

          expect(selectedTitles(canvas)).toEqual(['A', 'B', 'C'])
        })

        it('alt marquee removes from the selection', () => {
          click(canvas, 60, 60)
          click(canvas, 340, 60, { shiftKey: true })
          click(canvas, 340, 320, { shiftKey: true })

          marquee(canvas, [250, 0], [450, 100], { altKey: true })

          expect(selectedTitles(canvas)).toEqual(['A', 'C'])
          expect(b.selected).toBe(false)
        })
      }
    )

    it.fails('shift+alt marquee resolves the same way in both modes', () => {
      click(canvas, 60, 60)
      canvas.liveSelection = false
      marquee(canvas, [250, 0], [450, 400], { shiftKey: true, altKey: true })
      const classic = selectedTitles(canvas)

      click(canvas, 60, 60)
      canvas.liveSelection = true
      marquee(canvas, [250, 0], [450, 400], { shiftKey: true, altKey: true })

      expect(selectedTitles(canvas)).toEqual(classic)
    })

    it.fails('classic marquee requests a redraw', () => {
      canvas.liveSelection = false
      const setDirty = vi.spyOn(canvas, 'setDirty')

      marquee(canvas, [250, 0], [450, 400], {})

      expect(setDirty).toHaveBeenCalled()
    })
  })

  describe('groups with groupSelectChildren', () => {
    let group: LGraphGroup

    beforeEach(() => {
      canvas.groupSelectChildren = true
      group = addGroup(graph, 'G', [0, 0, 500, 300])
      group.recomputeInsideNodes()
    })

    it('selecting the group selects its children', () => {
      click(canvas, 250, 10)

      expect(selectedTitles(canvas)).toEqual(['A', 'B', 'G'])
    })

    it.fails('nested groups receive onSelected', () => {
      const inner = addGroup(graph, 'Inner', [10, 30, 200, 200])
      inner.recomputeInsideNodes()
      group.recomputeInsideNodes()
      const onSelected = vi.fn()
      Object.assign(inner, { onSelected })

      canvas.select(group)

      expect(inner.selected).toBe(true)
      expect(onSelected).toHaveBeenCalledTimes(1)
    })
  })

  describe('space bar pan override', () => {
    it.for([{ readOnly: true }, { readOnly: false }])(
      'restores read_only=$readOnly after release',
      ({ readOnly }) => {
        canvas.read_only = readOnly

        canvas.processKey(keyEvent('keydown', ' '))
        expect(canvas.read_only).toBe(true)

        canvas.processKey(keyEvent('keyup', ' '))
        expect(canvas.read_only).toBe(readOnly)
      }
    )
  })
})
