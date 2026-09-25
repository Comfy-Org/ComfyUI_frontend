import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { fromPartial } from '@total-typescript/shoehorn'

import type { Positionable, Rect } from '@/lib/litegraph/src/interfaces'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  resolveSelectable,
  selectableKeyOf
} from '@/renderer/core/canvas/litegraph/selectionAdapter'
import { useSelectionStore } from '@/core/selection/selectionStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

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
    canvas['finalizeLiveSelect']()
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

  it('keeps the deprecated selection pulse inert', () => {
    canvas.select(a)
    canvas.deselectAll()

    expect(canvas.state.selectionChanged).toBe(false)
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

    it('keeps a link highlighted while either endpoint stays selected', () => {
      a.addOutput('out', 'number')
      b.addInput('in', 'number')
      a.connect(0, b, 0)
      canvas.selectItems([a, b])

      canvas.deselect(a)
      expect(Object.keys(canvas.highlighted_links)).toHaveLength(1)

      canvas.select(a)
      canvas.deselect(b)
      expect(Object.keys(canvas.highlighted_links)).toHaveLength(1)

      canvas.deselect(a)
      expect(Object.keys(canvas.highlighted_links)).toHaveLength(0)
    })
  })

  describe('programmatic API', () => {
    it('publishes each selection before its synchronous node hook', () => {
      const store = useSelectionStore()
      const scope = graphScopeOf(graph)
      const selections: string[][] = []
      a.onSelected = () => selections.push([...store.selectedKeys(scope)])
      b.onSelected = () => selections.push([...store.selectedKeys(scope)])

      canvas.select(a)
      canvas.select(b)

      expect(selections).toEqual([
        [`node:${a.id}`],
        [`node:${a.id}`, `node:${b.id}`]
      ])
    })

    it.for(['single', 'all'] as const)(
      '%s deselection publishes before synchronous hooks',
      (mode) => {
        canvas.selectItems([a, b])
        const store = useSelectionStore()
        const scope = graphScopeOf(graph)
        const selections: string[][] = []
        const capture = () => selections.push([...store.selectedKeys(scope)])
        a.onDeselected = capture
        canvas.onNodeDeselected = capture
        canvas.onSelectionChange = capture

        const deselect = {
          single: () => canvas.deselect(a),
          all: () => canvas.deselectAll(b)
        }
        deselect[mode]()

        expect(selections).toEqual([[`node:${b.id}`], [`node:${b.id}`]])
      }
    )

    it('publishes retained legacy selection before bulk deselection hooks', () => {
      const target = addNode(graph, 'Target', 500, 40)
      a.addOutput('out', 'number')
      b.addOutput('out', 'number')
      target.addInput('first', 'number')
      target.addInput('second', 'number')
      a.connect(0, target, 0)
      const retainedLink = b.connect(0, target, 1)
      assert.exists(retainedLink)
      canvas.selectItems([a, b])
      a.onDeselected = vi.fn(() => {
        expect({
          keys: useSelectionStore().selectedKeys(graphScopeOf(graph)),
          items: [...canvas.selectedItems],
          nodes: canvas.selected_nodes,
          flags: [a.selected, b.selected],
          links: canvas.highlighted_links
        }).toEqual({
          keys: [`node:${b.id}`],
          items: [b],
          nodes: { [b.id]: b },
          flags: [false, true],
          links: { [retainedLink.id]: true }
        })
      })

      canvas.deselectAll(b)

      expect(a.onDeselected).toHaveBeenCalledOnce()
    })

    it('keeps selection made by a synchronous deselection hook', () => {
      canvas.select(a)
      a.onDeselected = () => canvas.select(b)

      canvas.deselectAll()

      expect([...canvas.selectedItems]).toEqual([b])
      expect(a.selected).toBe(false)
      expect(b.selected).toBe(true)
      expect(canvas.selected_nodes).toEqual({ [b.id]: b })
      expect(useSelectionStore().selectedKeys(graphScopeOf(graph))).toEqual([
        `node:${b.id}`
      ])
    })

    it('does not retain a foreign legacy item as a local selection', () => {
      const foreignGraph = new LGraph()
      const foreign = addNode(foreignGraph, 'Foreign', 0, 0)
      expect(foreign.id).toBe(a.id)
      foreign.selected = true
      canvas.select(a)
      canvas.selectedItems.add(foreign)

      canvas.deselectAll(foreign)

      expect(canvas.selectedItems.size).toBe(0)
      expect(canvas.selected_nodes).toEqual({})
      expect(useSelectionStore().selectedKeys(graphScopeOf(graph))).toEqual([])
      expect(a.selected).toBe(false)
      expect(foreign.selected).toBe(true)
    })

    it('bulk selection does at most linear key insertion work', () => {
      const count = 128
      const nodes = Array.from({ length: count }, (_, index) =>
        addNode(graph, `Node ${index}`, 0, 0)
      )
      const add = Set.prototype.add
      let keyInsertions = 0
      vi.spyOn(Set.prototype, 'add').mockImplementation(function (
        this: Set<unknown>,
        value: unknown
      ) {
        if (typeof value === 'string' && value.startsWith('node:'))
          keyInsertions++
        return add.call(this, value)
      })

      canvas.selectItems(nodes)

      expect(keyInsertions).toBeLessThanOrEqual(2 * count)
      expect(canvas.selectedItems.size).toBe(count)
      expect(
        useSelectionStore().selectedKeys(graphScopeOf(graph))
      ).toHaveLength(count)
    })

    it('does not classify an unsupported positionable as subgraph IO', () => {
      const item: Positionable = {
        id: a.id,
        pos: [0, 0],
        boundingRect: [0, 0, 10, 10],
        move: vi.fn(),
        snapToGrid: () => false
      }

      expect(selectableKeyOf(item)).toBeUndefined()
    })

    it.for([
      { additive: false, selected: false, callbacks: 1 },
      { additive: true, selected: true, callbacks: 0 }
    ])(
      'empty selectItems with additive=$additive',
      ({ additive, selected, callbacks }) => {
        canvas.select(a)
        a.onDeselected = vi.fn()

        canvas.selectItems([], additive)

        expect(canvas.selectedItems.has(a)).toBe(selected)
        expect(a.selected).toBe(selected)
        expect(a.onDeselected).toHaveBeenCalledTimes(callbacks)
        expect(
          useSelectionStore().isSelected(
            graphScopeOf(graph),
            selectableKeyOf(a)
          )
        ).toBe(selected)
      }
    )

    it.for(['group', 'reroute'] as const)(
      'direct %s removal clears only its selection before id reuse',
      (kind) => {
        const group = addGroup(graph, 'G', [400, 200, 100, 100])
        const reroute = graph.setReroute({ pos: [500, 500], linkIds: [] })!
        const targets = {
          group: {
            item: group,
            remove: () => graph.remove(group),
            recreate: () => graph.add(new LGraphGroup('Replacement', group.id))
          },
          reroute: {
            item: reroute,
            remove: () => graph.removeReroute(reroute.id),
            recreate: () =>
              graph.setReroute({ id: reroute.id, pos: [500, 500], linkIds: [] })
          }
        }
        const target = targets[kind]
        canvas.selectItems([a, target.item])

        target.remove()
        target.recreate()

        const replacement = resolveSelectable(
          graph,
          selectableKeyOf(target.item)
        )
        assert.exists(replacement)
        expect(replacement).not.toBe(target.item)
        expect(replacement.selected).toBeFalsy()
        expect([...canvas.selectedItems]).toEqual([a])
        expect(target.item.selected).toBe(false)
        expect(
          useSelectionStore().isSelected(
            graphScopeOf(graph),
            selectableKeyOf(target.item)
          )
        ).toBe(false)
      }
    )

    it('node removal clears a legacy-only selection entry', () => {
      canvas.selected_nodes[a.id] = a

      graph.remove(a)

      expect(canvas.selected_nodes).toEqual({})
    })

    it('node removal clears legacy selection before a deselection hook throws', () => {
      canvas.select(a)
      a.onDeselected = () => {
        expect(canvas.selected_nodes).toEqual({})
        throw new Error('deselection failed')
      }

      expect(() => graph.remove(a)).toThrow('deselection failed')
      expect(canvas.selected_nodes).toEqual({})
    })

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

    it('selectItems() preserves incremental hook state and reports one outer change', () => {
      const sizesSeenByHooks: number[] = []
      canvas.onNodeSelected = () =>
        sizesSeenByHooks.push(canvas.selectedItems.size)

      canvas.selectItems([a, b])

      expect(sizesSeenByHooks).toEqual([1, 2])
      expect(onSelectionChange).toHaveBeenCalledTimes(1)
    })

    it('continues a batch from selection changed by an earlier hook', () => {
      const secondHook = vi.fn(() => {
        expect(b.selected).toBe(true)
      })
      a.onSelected = () => canvas.deselectAll()
      b.onSelected = secondHook

      canvas.selectItems([a, b])

      expect(secondHook).toHaveBeenCalledOnce()
      expect([...canvas.selectedItems]).toEqual([b])
    })

    it('reselects a later batch item cleared by an earlier hook', () => {
      canvas.select(b)
      a.onSelected = () => canvas.deselectAll()
      b.onSelected = vi.fn()

      canvas.selectItems([a, b], true)

      expect(b.onSelected).toHaveBeenCalledOnce()
      expect([...canvas.selectedItems]).toEqual([b])
    })

    it('skips a later batch item removed by an earlier hook', () => {
      a.onSelected = () => graph.remove(b)
      b.onSelected = vi.fn()

      canvas.selectItems([a, b])

      expect(b.onSelected).not.toHaveBeenCalled()
      expect([...canvas.selectedItems]).toEqual([a])
    })

    it('keeps the selection view unchanged for a no-op deselect', () => {
      canvas.select(a)
      const selection = canvas.selectedItems

      canvas.deselect(b)

      expect(canvas.selectedItems).toBe(selection)
    })

    it('highlights a link connected after the node was selected', () => {
      a.addOutput('out', 'number')
      b.addInput('in', 'number')
      canvas.select(a)
      expect(Object.keys(canvas.highlighted_links)).toHaveLength(0)

      const link = a.connect(0, b, 0)
      assert.exists(link)

      expect(canvas.highlighted_links).toEqual({ [link.id]: true })
    })

    it('reuses the selection view while selection and topology are unchanged', () => {
      const selectedKeys = vi.spyOn(useSelectionStore(), 'selectedKeys')
      canvas.select(a)
      selectedKeys.mockClear()

      expect(canvas.selected_nodes[a.id]).toBe(a)
      expect(canvas.highlighted_links).toEqual({})

      expect(selectedKeys).toHaveBeenCalledOnce()

      canvas.deselect(a)
      selectedKeys.mockClear()

      expect(canvas.selected_nodes).toEqual({})
      expect(selectedKeys).toHaveBeenCalledOnce()
    })

    it('supports legacy highlighted_links clear assignment', () => {
      canvas.select(a)

      expect(() => {
        canvas.highlighted_links = {}
      }).not.toThrow()
    })

    it('keeps selection reads bounded for a bulk collapse', () => {
      const nodes = Array.from({ length: 32 }, (_, index) =>
        addNode(graph, `Bulk ${index}`, 200 + index * 10, 200)
      )
      canvas.selectItems(nodes)
      LGraphCanvas.active_canvas = canvas
      graph._version++
      const selectedKeys = vi.spyOn(useSelectionStore(), 'selectedKeys')

      LGraphCanvas.onMenuNodeCollapse(
        { content: 'Collapse' },
        {},
        new MouseEvent('click'),
        fromPartial<Parameters<typeof LGraphCanvas.onMenuNodeCollapse>[3]>({}),
        nodes[0]
      )

      expect(nodes.map((node) => node.collapsed)).toEqual(Array(32).fill(true))
      expect(selectedKeys.mock.calls.length).toBeLessThanOrEqual(5)
    })

    it('assigning selected_nodes replaces the selection', () => {
      canvas.select(a)

      canvas.selected_nodes = { [b.id]: b }

      expect(selectedTitles(canvas)).toEqual(['B'])
      expect(canvas.selected_nodes).toEqual({ [b.id]: b })
      expect(a.selected).toBe(false)
      expect(b.selected).toBe(true)
    })

    it('records and removes every selectable kind', () => {
      const group = addGroup(graph, 'G', [400, 200, 100, 100])
      const reroute = graph.setReroute({ pos: [500, 500], linkIds: [] })!
      const subgraph = createTestSubgraph({ rootGraph: graph })

      for (const item of [a, group, reroute]) canvas.select(item)
      expect(canvas.selectedItems.size).toBe(3)
      for (const item of [a, group, reroute]) canvas.deselect(item)
      expect(canvas.selectedItems.size).toBe(0)

      canvas.setGraph(subgraph)
      graph = subgraph
      const ioNodes = [subgraph.inputNode, subgraph.outputNode]
      for (const item of ioNodes) canvas.select(item)
      expect(canvas.selectedItems.size).toBe(2)
      for (const item of ioNodes) canvas.deselect(item)
      expect(canvas.selectedItems.size).toBe(0)
    })

    it('graph.clear() evicts the selection of every scope in that root', () => {
      const store = useSelectionStore()
      const subgraph = createTestSubgraph({ rootGraph: graph })
      const scopes = [graphScopeOf(graph), graphScopeOf(subgraph)]
      for (const scope of scopes) {
        store.apply(scope, {
          type: 'selection.add',
          key: selectableKeyOf(a)
        })
      }

      graph.clear()

      for (const scope of scopes) expect(store.selectedKeys(scope)).toEqual([])
    })

    it('subgraph.clear() evicts only that graph scope', () => {
      const store = useSelectionStore()
      const subgraph = createTestSubgraph({ rootGraph: graph })
      const scope = graphScopeOf(subgraph)
      const rootScope = graphScopeOf(graph)
      const rootGroup = addGroup(graph, 'Root', [0, 0, 100, 100])
      const selectedGroup = addGroup(subgraph, 'Selected', [0, 0, 100, 100])
      canvas.select(rootGroup)
      store.apply(scope, {
        type: 'selection.add',
        key: selectableKeyOf(selectedGroup)
      })

      subgraph.clear()
      const replacement = new LGraphGroup('Replacement', selectedGroup.id)
      subgraph.add(replacement)

      expect(store.selectedKeys(scope)).toEqual([])
      expect(store.selectedKeys(rootScope)).toEqual([
        selectableKeyOf(rootGroup)
      ])
      expect(
        store.isSelected(graphScopeOf(subgraph), selectableKeyOf(replacement))
      ).toBe(false)
    })

    it('ignores items owned by another graph', () => {
      const foreignGraph = new LGraph()
      const foreignNode = addNode(foreignGraph, 'Foreign', 20, 40)
      foreignNode.id = a.id
      canvas.select(a)

      canvas.select(foreignNode)
      canvas.deselect(foreignNode)
      canvas.selectItems([foreignNode])

      expect(canvas.selectedItems.size).toBe(1)
      expect(canvas.selectedItems.has(a)).toBe(true)
      expect(foreignNode.selected).toBeFalsy()
      expect(a.selected).toBe(true)
    })

    it('ignores removal of a foreign group with a selected group ID', () => {
      const selectedGroup = addGroup(graph, 'Selected', [0, 0, 100, 100])
      const foreignGroup = new LGraphGroup('Foreign', selectedGroup.id)
      canvas.select(selectedGroup)

      graph.remove(foreignGroup)

      expect(selectedGroup.selected).toBe(true)
      expect(canvas.selectedItems).toContain(selectedGroup)
    })

    it('removes the target group after a deselection hook shifts group order', () => {
      const earlier = addGroup(graph, 'Earlier', [600, 0, 100, 100])
      const target = addGroup(graph, 'Target', [0, 0, 200, 200])
      const later = addGroup(graph, 'Later', [800, 0, 100, 100])
      canvas.groupSelectChildren = true
      canvas.select(target)
      a.onDeselected = () => graph.remove(earlier)

      graph.remove(target)

      expect(graph._groups).toEqual([later])
      expect(target.graph).toBeUndefined()
      expect(later.graph).toBe(graph)
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

    it('reports when a deselection hook selects a replacement item', () => {
      canvas.select(a)
      a.onDeselected = () => canvas.select(b)

      canvas.deselectAll()

      expect(onSelectionChange).toHaveBeenCalledTimes(1)
      expect(selectedTitles(canvas)).toEqual(['B'])
    })

    it('deselectAll(keepSelected) keeps only that item', () => {
      canvas.select(a)
      canvas.select(b)

      canvas.deselectAll(b)

      expect(selectedTitles(canvas)).toEqual(['B'])
      expect(a.selected).toBe(false)
      expect(onSelectionChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('legacy selectedItems Set', () => {
    it('add() selects through the store', () => {
      canvas.selectedItems.add(a)

      expect(selectedTitles(canvas)).toEqual(['A'])
      expect(Object.keys(canvas.selected_nodes)).toEqual([String(a.id)])
    })

    it('ignores a foreign item with the same key', () => {
      const foreignGraph = new LGraph()
      const foreign = addNode(foreignGraph, 'Foreign', 0, 0)
      expect(foreign.id).toBe(a.id)

      canvas.selectedItems.add(foreign)
      expect(canvas.selectedItems.size).toBe(0)

      canvas.select(a)
      expect(canvas.selectedItems.delete(foreign)).toBe(false)
      expect([...canvas.selectedItems]).toEqual([a])
    })

    it('delete() deselects and reports whether the item was selected', () => {
      canvas.select(a)
      canvas.select(b)

      expect(canvas.selectedItems.delete(a)).toBe(true)
      expect(canvas.selectedItems.delete(a)).toBe(false)
      expect(selectedTitles(canvas)).toEqual(['B'])
    })

    it('held snapshots report current membership when deleting', () => {
      canvas.select(a)
      const snapshot = canvas.selectedItems

      expect(snapshot.delete(a)).toBe(true)
      expect(snapshot.delete(a)).toBe(false)

      canvas.select(a)
      expect(snapshot.delete(a)).toBe(true)
      expect(canvas.selectedItems.size).toBe(0)
    })

    it('clear() empties the selection', () => {
      canvas.select(a)
      canvas.select(b)

      canvas.selectedItems.clear()

      expect(canvas.selectedItems.size).toBe(0)
      expect(Object.keys(canvas.selected_nodes)).toEqual([])
    })

    it('assignment replaces the selection', () => {
      canvas.select(a)

      canvas.selectedItems = new Set([b])

      expect(selectedTitles(canvas)).toEqual(['B'])
      expect(a.selected).toBe(false)
      expect(b.selected).toBe(true)
    })

    it('assignment with only foreign items clears the selection', () => {
      const foreignGraph = new LGraph()
      const foreign = addNode(foreignGraph, 'Foreign', 0, 0)
      canvas.select(a)

      canvas.selectedItems = new Set([foreign])

      expect(canvas.selectedItems.size).toBe(0)
      expect(a.selected).toBe(false)
    })

    it('a held snapshot stays stable while the property reflects the store', () => {
      canvas.select(a)
      const snapshot = canvas.selectedItems

      canvas.select(b)

      expect([...snapshot]).toEqual([a])
      expect([...canvas.selectedItems]).toEqual([a, b])
    })

    it('a held snapshot keeps mutating its original graph', () => {
      canvas.select(a)
      const firstGraphSnapshot = canvas.selectedItems
      const secondGraph = new LGraph()
      const secondGraphNode = addNode(secondGraph, 'Second graph', 0, 0)
      canvas.setGraph(secondGraph)
      canvas.select(secondGraphNode)
      const store = useSelectionStore()
      const firstScope = graphScopeOf(graph)
      store.apply(firstScope, {
        type: 'selection.add',
        key: selectableKeyOf(a)
      })
      expect(store.selectedKeys(firstScope)).toEqual([selectableKeyOf(a)])

      firstGraphSnapshot.clear()

      expect(store.selectedKeys(firstScope)).toEqual([])
      expect(store.selectedKeys(graphScopeOf(secondGraph))).toEqual([
        selectableKeyOf(secondGraphNode)
      ])

      canvas.setGraph(graph)
    })
  })

  describe('item.selected accessor', () => {
    const kinds: { kind: string; create: (graph: LGraph) => Positionable }[] = [
      { kind: 'node', create: (graph) => addNode(graph, 'N', 500, 40) },
      {
        kind: 'group',
        create: (graph) => addGroup(graph, 'G', [400, 200, 100, 100])
      },
      {
        kind: 'reroute',
        create: (graph) => graph.setReroute({ pos: [500, 500], linkIds: [] })!
      }
    ]

    it.for(kinds)(
      '$kind: legacy write goes through the store',
      ({ create }) => {
        const item = create(graph)

        item.selected = true
        expect([...canvas.selectedItems]).toEqual([item])

        item.selected = false
        expect(canvas.selectedItems.size).toBe(0)
      }
    )

    it.for(kinds)('$kind: read reflects the store', ({ create }) => {
      const item = create(graph)

      canvas.select(item)
      expect(item.selected).toBe(true)

      canvas.deselect(item)
      expect(item.selected).toBe(false)
    })

    it.for<{
      kind: string
      create: () => LGraphNode | LGraphGroup
    }>([
      { kind: 'node', create: () => new LGraphNode('detached') },
      { kind: 'group', create: () => new LGraphGroup('detached') }
    ])('$kind preserves a detached write when added', ({ create }) => {
      const item = create()

      item.selected = true

      expect(item.selected).toBe(true)
      graph.add(item)
      expect(item.selected).toBe(true)
      expect(canvas.selectedItems).toContain(item)
    })

    it('direct writes cover both subgraph IO nodes', () => {
      const subgraph = createTestSubgraph({ rootGraph: graph })
      canvas.setGraph(subgraph)

      for (const ioNode of [subgraph.inputNode, subgraph.outputNode]) {
        ioNode.selected = true
        expect(canvas.selectedItems).toContain(ioNode)
        ioNode.selected = false
        expect(canvas.selectedItems).not.toContain(ioNode)
      }

      canvas.setGraph(graph)
    })

    it('node removal clears selection without a registered canvas', () => {
      const graphWithoutCanvas = new LGraph()
      const node = addNode(graphWithoutCanvas, 'Selected', 0, 0)
      node.selected = true

      graphWithoutCanvas.remove(node)

      expect(
        useSelectionStore().isSelected(
          graphScopeOf(graphWithoutCanvas),
          selectableKeyOf(node)
        )
      ).toBe(false)
    })

    it('adopts detached selection under the final ID after reminting', () => {
      const subgraph = createTestSubgraph({ rootGraph: graph })
      const node = new LGraphNode('Colliding selected node')
      node.id = a.id
      node.selected = true

      subgraph.add(node)

      expect(node.id).not.toBe(a.id)
      expect(node.selected).toBe(true)
      expect(useSelectionStore().selectedKeys(graphScopeOf(subgraph))).toEqual([
        selectableKeyOf(node)
      ])
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

    it.fails('live marquee reports one change', () => {
      canvas.liveSelection = true

      marquee(canvas, [250, 0], [450, 400], {})

      expect(onSelectionChange).toHaveBeenCalledTimes(1)
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

    it('deselecting the group fires each child hook once', () => {
      canvas.select(group)
      const aDeselected = vi.fn()
      const bDeselected = vi.fn()
      a.onDeselected = aDeselected
      b.onDeselected = bDeselected

      canvas.deselect(group)

      expect(aDeselected).toHaveBeenCalledOnce()
      expect(bDeselected).toHaveBeenCalledOnce()
      expect(canvas.selectedItems.size).toBe(0)
    })

    it('live marquee shrink preserves child deselect-select hook churn', () => {
      const aSelected = vi.fn()
      const bSelected = vi.fn()
      const aDeselected = vi.fn()
      const bDeselected = vi.fn()
      a.onSelected = aSelected
      b.onSelected = bSelected
      a.onDeselected = aDeselected
      b.onDeselected = bDeselected
      canvas.select(group)
      aSelected.mockClear()
      bSelected.mockClear()
      const initialSelection = new Set(canvas.selectedItems)
      const dragRect: Rect = [10, 30, 450, 250]

      canvas['handleLiveSelect'](
        fromPartial<CanvasPointerEvent>({ canvasX: 460, canvasY: 280 }),
        dragRect,
        initialSelection
      )

      expect(aDeselected).toHaveBeenCalledOnce()
      expect(bDeselected).toHaveBeenCalledOnce()
      expect(aSelected).toHaveBeenCalledOnce()
      expect(bSelected).toHaveBeenCalledOnce()
      expect(selectedTitles(canvas)).toEqual(['A', 'B'])
    })

    it('visits a descendant once through nested group caches', () => {
      const inner = addGroup(graph, 'Inner', [10, 30, 200, 200])
      inner.recomputeInsideNodes()
      group.recomputeInsideNodes()
      a.onSelected = vi.fn(() => canvas.deselect(a))

      canvas.select(group)

      expect(a.onSelected).toHaveBeenCalledOnce()
    })

    it('does not deselect a same-ID replacement through a stale group child', () => {
      canvas.select(group)
      const replacement = new LGraphNode('Replacement')
      replacement.id = a.id
      replacement.pos = [700, 500]
      graph.remove(a)
      graph.add(replacement)
      canvas.select(replacement)

      canvas.deselect(group)

      expect([...canvas.selectedItems]).toEqual([replacement])
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

    it('ignores a release without a matching press', () => {
      canvas.read_only = true

      canvas.processKey(keyEvent('keyup', ' '))

      expect(canvas.read_only).toBe(true)
    })

    it('clears held state when the graph is detached before release', () => {
      canvas.processKey(keyEvent('keydown', ' '))
      graph.detachCanvas(canvas)

      canvas.processKey(keyEvent('keyup', ' '))
      expect(canvas.read_only).toBe(false)

      new LGraph().attachCanvas(canvas)
      canvas.read_only = true
      canvas.processKey(keyEvent('keydown', ' '))
      canvas.processKey(keyEvent('keyup', ' '))

      expect(canvas.read_only).toBe(true)
    })
  })
})
