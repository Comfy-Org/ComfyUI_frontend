import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { apiOnTestCanvas } from '@/platform/nodeApi/v4/events/__tests__/testCanvasSource'

const SCREEN = { x: 100, y: 50, width: 400, height: 200 }

function canvasShowing(graph: LGraph) {
  stubCanvasGetContext()
  const element = document.createElement('canvas')
  element.width = SCREEN.width
  element.height = SCREEN.height
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect(SCREEN)
  )
  const canvas = new LGraphCanvas(element, graph, { skip_render: true })
  document.body.append(element)
  onTestFinished(() => element.remove())
  return canvas
}

function documentOnScreen() {
  const root = new LGraph()
  const first = new LGraphNode('First')
  const second = new LGraphNode('Second')
  root.add(first)
  root.add(second)
  const subgraph = createTestSubgraph({ rootGraph: root })
  root.subgraphs.set(subgraph.id, subgraph)
  root.add(createTestSubgraphNode(subgraph, { parentGraph: root }))
  const inner = new LGraphNode('Inner')
  subgraph.add(inner)
  const canvas = canvasShowing(root)
  const { comfy, host, useCanvas, show } = apiOnTestCanvas(root)
  useCanvas(canvas)
  const handle = (node: LGraphNode) => {
    const found = comfy.graph.node(String(node.id))
    assert(found)
    return found
  }
  return {
    root,
    first,
    second,
    subgraph,
    inner,
    canvas,
    comfy,
    host,
    handle,
    show
  }
}

function addGroups(graph: LGraph, ...titles: string[]): LGraphGroup[] {
  return titles.map((title) => {
    const group = new LGraphGroup(title)
    graph.add(group)
    return group
  })
}

describe('graph.selection and graph.select', () => {
  it('reads what the canvas selected, in the graph order, frozen', () => {
    const { first, second, canvas, comfy, handle } = documentOnScreen()

    canvas.select(second)
    canvas.select(first)

    expect(comfy.graph.selection()).toEqual([handle(first), handle(second)])
    expect(Object.isFrozen(comfy.graph.selection())).toBe(true)
  })

  it('selects exactly the nodes it is given, through the canvas, and clears with an empty list', () => {
    const { first, second, canvas, comfy, handle } = documentOnScreen()
    canvas.select(first)

    comfy.graph.select([handle(second)])

    expect(comfy.graph.selection()).toEqual([handle(second)])
    expect([...canvas.selectedItems]).toEqual([second])

    comfy.graph.select([])

    expect(comfy.graph.selection()).toEqual([])
    expect(canvas.selectedItems.size).toBe(0)
  })

  it('selects nothing and says false when a node is gone or not on screen', () => {
    const { first, second, inner, root, canvas, comfy, handle } =
      documentOnScreen()
    canvas.select(first)
    const innerHandle = comfy.graph.subgraphs()[0].node(String(inner.id))
    assert(innerHandle)
    const gone = handle(second)
    root.remove(second)

    expect(comfy.graph.select([handle(first), innerHandle])).toBe(false)
    expect(comfy.graph.select([gone])).toBe(false)
    expect(comfy.graph.selection()).toEqual([handle(first)])
  })

  it('refuses a value that is not a handle it made, and leaves the selection alone', () => {
    const { first, root, canvas, comfy, handle } = documentOnScreen()
    canvas.select(first)

    for (const refused of [
      [{ id: String(first.id), graphId: root.id }],
      [null],
      [createComfyApi({ getGraph: () => root }).comfy.graph.nodes()[0]]
    ]) {
      expect(() =>
        Reflect.apply(comfy.graph.select, comfy.graph, [refused])
      ).toThrow('select needs a node handle')
    }
    expect(() =>
      Reflect.apply(comfy.graph.select, comfy.graph, ['all'])
    ).toThrow("select needs a list of node handles, not 'all'.")
    expect(comfy.graph.selection()).toEqual([handle(first)])
  })

  it('is empty, and selecting does nothing, before there is a canvas', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(comfy.graph.selection()).toEqual([])
    expect(comfy.graph.select([])).toBe(false)
  })
})

describe('graph.groupSelection', () => {
  it('reads the groups the canvas selected, in draw order, frozen, apart from the nodes', () => {
    const { root, first, canvas, comfy, handle } = documentOnScreen()
    const [back, middle, front] = addGroups(root, 'Back', 'Middle', 'Front')
    const groups = comfy.graph.groups() ?? []

    canvas.select(front)
    canvas.select(first)
    canvas.select(back)

    expect(comfy.graph.groupSelection()).toEqual([groups[0], groups[2]])
    expect(comfy.graph.groupSelection()[0]).toBe(groups[0])
    expect(Object.isFrozen(comfy.graph.groupSelection())).toBe(true)
    expect(comfy.graph.selection()).toEqual([handle(first)])

    canvas.deselect(front)
    canvas.select(middle)

    expect(comfy.graph.groupSelection()).toEqual([groups[0], groups[1]])
  })

  it('reads the graph the user is in, not the one left behind', () => {
    const { root, subgraph, canvas, comfy, show } = documentOnScreen()
    const [outer] = addGroups(root, 'Outer')
    const [inner] = addGroups(subgraph, 'Inner')
    canvas.select(outer)

    canvas.setGraph(subgraph)
    show(subgraph)
    canvas.select(inner)

    expect(comfy.graph.groupSelection()).toEqual(
      comfy.graph.subgraphs()[0].groups()
    )
    expect(comfy.graph.groupSelection()[0].getTitle()).toBe('Inner')
  })

  it('drops a selected group once it is removed', () => {
    const { root, canvas, comfy } = documentOnScreen()
    const [kept, removed] = addGroups(root, 'Kept', 'Removed')
    canvas.select(kept)
    canvas.select(removed)
    expect(comfy.graph.groupSelection()).toHaveLength(2)

    root.remove(removed)

    expect(
      comfy.graph.groupSelection().map((group) => group.getTitle())
    ).toEqual(['Kept'])
  })

  it('is empty and frozen before there is a graph on screen', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(comfy.graph.groupSelection()).toEqual([])
    expect(Object.isFrozen(comfy.graph.groupSelection())).toBe(true)
  })
})

describe('graph.centerOn', () => {
  it('puts the node in the middle of the view, keeps the zoom, and tells viewport listeners', () => {
    const { first, canvas, comfy, handle } = documentOnScreen()
    first.pos = [500, 700]
    canvas.ds.scale = 2
    const changed = vi.fn()
    comfy.onViewportChanged(changed)
    canvas.dirty_canvas = false

    expect(comfy.graph.centerOn(handle(first))).toBe(true)

    const centre = canvas.ds.convertOffsetToCanvas([
      first.pos[0] + first.size[0] / 2,
      first.pos[1] + first.size[1] / 2
    ])
    expect(centre[0] * canvas.dpr).toBeCloseTo(SCREEN.width / 2)
    expect(centre[1] * canvas.dpr).toBeCloseTo(SCREEN.height / 2)
    expect(canvas.ds.scale).toBe(2)
    expect(canvas.dirty_canvas).toBe(true)
    expect(changed).toHaveBeenCalledOnce()
  })

  it('says false without moving the view for a node not on screen, or gone', () => {
    const { second, inner, root, canvas, comfy, handle } = documentOnScreen()
    const innerHandle = comfy.graph.subgraphs()[0].node(String(inner.id))
    assert(innerHandle)
    const gone = handle(second)
    root.remove(second)
    const before = [...canvas.ds.offset]

    expect(comfy.graph.centerOn(innerHandle)).toBe(false)
    expect(comfy.graph.centerOn(gone)).toBe(false)
    expect([...canvas.ds.offset]).toEqual(before)
  })

  it('refuses a value that is not a node handle', () => {
    const { comfy } = documentOnScreen()

    expect(() =>
      Reflect.apply(comfy.graph.centerOn, comfy.graph, [{ id: '1' }])
    ).toThrow('centerOn needs a node handle')
  })

  it('says false before there is a canvas', () => {
    const graph = new LGraph()
    graph.add(new LGraphNode('Alone'))
    const { comfy } = apiOnTestCanvas(graph)

    expect(comfy.graph.centerOn(comfy.graph.nodes()[0])).toBe(false)
  })
})

describe('graph.pointerPosition', () => {
  it('gives where the pointer last was, in graph space, frozen', () => {
    const { canvas, comfy } = documentOnScreen()
    canvas.graph_mouse[0] = 12
    canvas.graph_mouse[1] = 34

    const position = comfy.graph.pointerPosition()

    expect(position).toEqual({ x: 12, y: 34 })
    expect(Object.isFrozen(position)).toBe(true)
  })

  it('is undefined before there is a canvas', () => {
    expect(
      createComfyApi({ getGraph: () => null }).comfy.graph.pointerPosition()
    ).toBeUndefined()
  })
})

describe('graph.setZoom', () => {
  it('zooms about the middle of the view and tells viewport listeners', () => {
    const { canvas, comfy } = documentOnScreen()
    const middle: [number, number] = [SCREEN.width / 2, SCREEN.height / 2]
    const before = canvas.ds.convertCanvasToOffset(middle)
    const changed = vi.fn()
    comfy.onViewportChanged(changed)
    canvas.dirty_canvas = false
    canvas.dirty_bgcanvas = false

    comfy.graph.setZoom(2)

    expect(canvas.ds.scale).toBe(2)
    expect(canvas.ds.convertCanvasToOffset(middle)).toEqual(before)
    expect([canvas.dirty_canvas, canvas.dirty_bgcanvas]).toEqual([true, true])
    expect(changed).toHaveBeenCalledOnce()
  })

  it('clamps to the zoom the canvas allows', () => {
    const { canvas, comfy } = documentOnScreen()

    comfy.graph.setZoom(1e9)

    expect(canvas.ds.scale).toBe(canvas.ds.max_scale)
  })

  it.for([0, -1, Number.NaN, Infinity, '2'])(
    'refuses %s before changing the view',
    (scale) => {
      const { canvas, comfy } = documentOnScreen()

      expect(() =>
        Reflect.apply(comfy.graph.setZoom, comfy.graph, [scale])
      ).toThrow('setZoom needs a positive scale')
      expect(canvas.ds.scale).toBe(1)
    }
  )
})

describe('graph.panBy', () => {
  it('pans by screen pixels at any zoom, redraws, and tells viewport listeners', () => {
    const { canvas, comfy } = documentOnScreen()
    canvas.ds.scale = 2
    const [x, y] = canvas.ds.offset
    const changed = vi.fn()
    comfy.onViewportChanged(changed)
    canvas.dirty_canvas = false
    canvas.dirty_bgcanvas = false

    comfy.graph.panBy({ x: 40, y: -20 })

    expect([...canvas.ds.offset]).toEqual([x + 20, y - 10])
    expect([canvas.dirty_canvas, canvas.dirty_bgcanvas]).toEqual([true, true])
    expect(changed).toHaveBeenCalledOnce()
  })

  it.for([
    null,
    { x: 1 },
    { x: Number.NaN, y: 0 },
    { x: 0, y: Infinity },
    { x: '1', y: 0 },
    [1, 2]
  ])('refuses %o before changing the view', (delta) => {
    const { canvas, comfy } = documentOnScreen()
    const before = [...canvas.ds.offset]

    expect(() =>
      Reflect.apply(comfy.graph.panBy, comfy.graph, [delta])
    ).toThrow('panBy needs a distance of finite x and y')
    expect([...canvas.ds.offset]).toEqual(before)
  })

  it('does nothing, like setZoom, before there is a canvas', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(() => comfy.graph.panBy({ x: 1, y: 1 })).not.toThrow()
    expect(() => comfy.graph.setZoom(2)).not.toThrow()
  })
})

describe('group.centerOn', () => {
  it('puts the group in the middle of the view and tells viewport listeners', () => {
    const { root, canvas, comfy } = documentOnScreen()
    const group = new LGraphGroup('Framed')
    group.pos = [300, 400]
    group.size = [200, 100]
    root.add(group)
    const [handle] = comfy.graph.groups() ?? []
    assert(handle)
    canvas.ds.scale = 2
    const changed = vi.fn()
    comfy.onViewportChanged(changed)

    expect(handle.centerOn()).toBe(true)

    const centre = canvas.ds.convertOffsetToCanvas([400, 450])
    expect(centre[0] * canvas.dpr).toBeCloseTo(SCREEN.width / 2)
    expect(centre[1] * canvas.dpr).toBeCloseTo(SCREEN.height / 2)
    expect(changed).toHaveBeenCalledOnce()
  })

  it('says false without moving the view for a group not on screen, or gone', () => {
    const { root, subgraph, canvas, comfy } = documentOnScreen()
    const inside = new LGraphGroup('Inside')
    subgraph.add(inside)
    const elsewhere = comfy.graph.subgraphs()[0].groups()?.[0]
    const leaving = new LGraphGroup('Leaving')
    root.add(leaving)
    const gone = comfy.graph.groups()?.[0]
    assert(elsewhere && gone)
    root.remove(leaving)
    const before = [...canvas.ds.offset]

    expect(elsewhere.centerOn()).toBe(false)
    expect(gone.centerOn()).toBe(false)
    expect([...canvas.ds.offset]).toEqual(before)
  })
})
