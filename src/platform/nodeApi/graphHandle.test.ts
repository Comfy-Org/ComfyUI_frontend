import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'

import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import { ComfyApiError } from './errors'
import { createGraphApi } from './graphHandle'
import type { GraphHandle } from './graphHandle'

describe('graph API (composed)', () => {
  let graph: LGraph
  let api: GraphHandle

  function addNode(title: string, type: string) {
    const node = new LGraphNode(title, type)
    graph.add(node)
    return node
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    api = createGraphApi(() => graph)
  })

  describe('node access', () => {
    it('lists nodes and finds them by id and type', () => {
      const a = addNode('A', 'Alpha')
      addNode('B', 'Beta')

      expect(api.nodes()).toHaveLength(2)
      expect(api.node(String(a.id))?.getTitle()).toBe('A')
      expect(api.nodesOfType('Beta').map((n) => n.getTitle())).toEqual(['B'])
    })

    it('builds the registered node type, not a bare node', () => {
      // `new LGraphNode(title, type)` produces a node with no inputs, outputs
      // or widgets, because those come from the registered class. A pack that
      // adds a node and then reads its slots — recreating a node as another
      // type, say — gets an empty shell and silently wires nothing.
      class Registered extends LGraphNode {
        constructor(title?: string) {
          super(title ?? 'Registered', 'Registered')
          this.addInput('image', 'IMAGE')
          this.addOutput('latent', 'LATENT')
          this.addWidget('number', 'seed', 7, () => {})
        }
      }
      LiteGraph.registerNodeType('Registered', Registered)

      try {
        const handle = api.add('Registered')
        expect(handle.inputs.all().map((i) => i.name)).toEqual(['image'])
        expect(handle.outputs.all().map((o) => o.name)).toEqual(['latent'])
        expect(handle.widgets.get('seed')?.getValue()).toBe(7)
      } finally {
        LiteGraph.unregisterNodeType('Registered')
      }
    })

    it('refuses a type that is not registered', () => {
      expect(() => api.add('NoSuchType')).toThrow(ComfyApiError)
    })

    it('returns undefined for a node that is not present', () => {
      expect(api.node('999')).toBeUndefined()
    })

    it('adds and removes nodes', () => {
      LiteGraph.registerNodeType('Gamma', class extends LGraphNode {})
      try {
        const handle = api.add('Gamma', {
          title: 'G',
          position: { x: 5, y: 6 }
        })
        expect(handle.type).toBe('Gamma')
        expect(handle.getPosition()).toEqual({ x: 5, y: 6 })

        expect(api.remove(handle.id)).toBe(true)
        expect(handle.isDeleted).toBe(true)
        expect(api.remove(handle.id)).toBe(false)
      } finally {
        LiteGraph.unregisterNodeType('Gamma')
      }
    })

    it('gives a clear error when there is no active graph', () => {
      const detached = createGraphApi(() => null)
      expect(() => detached.add('Alpha')).toThrow(ComfyApiError)
      expect(() => detached.add('Alpha')).toThrow(/no graph is active/)
      // Reads stay total rather than throwing.
      expect(detached.nodes()).toEqual([])
      expect(detached.node('1')).toBeUndefined()
    })
  })

  describe('collections are reachable and identity-stable', () => {
    it('exposes inputs, outputs and widgets from a node handle', () => {
      const node = addNode('A', 'Alpha')
      node.addInput('image', 'IMAGE')
      node.addOutput('IMAGE', 'IMAGE')
      node.addWidget('number', 'seed', 1, () => undefined, {})

      const handle = api.node(String(node.id))!
      expect(handle.inputs.names()).toEqual(['image'])
      expect(handle.outputs.names()).toEqual(['IMAGE'])
      expect(handle.widgets.names()).toEqual(['seed'])
    })

    it('returns the same collection object across reads', () => {
      const node = addNode('A', 'Alpha')
      const handle = api.node(String(node.id))!
      expect(handle.inputs).toBe(handle.inputs)
      expect(handle.widgets).toBe(handle.widgets)
    })
  })

  describe('end-to-end wiring', () => {
    it('connects two nodes and reports the link from the graph', () => {
      const source = addNode('S', 'Source')
      source.addOutput('IMAGE', 'IMAGE')
      const target = addNode('T', 'Target')
      target.addInput('image', 'IMAGE')

      const s = api.node(String(source.id))!
      const t = api.node(String(target.id))!
      s.outputs.byName('IMAGE')!.connectTo(t.id, 'image')

      expect(t.inputs.byName('image')!.isConnected).toBe(true)
      const links = api.links()
      expect(links).toHaveLength(1)
      expect(links[0].sourceNodeId).toBe(s.id)
      expect(links[0].targetNodeId).toBe(t.id)
      expect(Object.isFrozen(links[0])).toBe(true)
    })

    it('drops links when a node is removed', () => {
      const source = addNode('S', 'Source')
      source.addOutput('IMAGE', 'IMAGE')
      const target = addNode('T', 'Target')
      target.addInput('image', 'IMAGE')

      const s = api.node(String(source.id))!
      s.outputs.byName('IMAGE')!.connectTo(String(target.id), 'image')
      expect(api.links()).toHaveLength(1)

      api.remove(String(target.id))
      expect(api.links()).toHaveLength(0)
    })
  })

  describe('nothing internal escapes the composed surface', () => {
    it('has no path from the graph API to LGraph or LGraphNode', () => {
      const node = addNode('A', 'Alpha')
      node.addInput('image', 'IMAGE')
      node.addWidget('number', 'seed', 1, () => undefined, {})

      const seen = new Set<unknown>()
      const reaches = (value: unknown, depth: number): boolean => {
        if (depth > 5 || value === null || typeof value !== 'object') {
          return false
        }
        if (value === graph || value === node) return true
        if (seen.has(value)) return false
        seen.add(value)
        return Object.values(value).some((v) => reaches(v, depth + 1))
      }

      expect(reaches(api.node(String(node.id)), 0)).toBe(false)
      expect(reaches(api.nodes(), 0)).toBe(false)
      expect(reaches(api.links(), 0)).toBe(false)
    })
  })

  describe('handle caches do not grow unboundedly', () => {
    it('sheds cache slots for removed nodes on prune', () => {
      const ids = Array.from({ length: 20 }, (_, i) => {
        const n = addNode(`N${i}`, 'Alpha')
        return String(n.id)
      })
      ids.forEach((id) => api.node(id))
      expect(api.cacheSize).toBeGreaterThanOrEqual(20)

      ids.forEach((id) => api.remove(id))
      expect(api.nodes()).toHaveLength(0)
    })
  })
})

describe('hit testing', () => {
  it('finds the node under a point, and nothing where there is none', () => {
    const graph = new LGraph()
    const node = new LGraphNode('T', 'TestNode')
    graph.add(node)
    node.pos = [100, 100]
    node.size = [140, 80]
    // The hit test reads the rendered layout; stand in for a frame.
    node.updateArea()
    const api = createGraphApi(() => graph)

    expect(api.nodeAt({ x: 150, y: 130 })?.id).toBe(String(node.id))
    expect(api.nodeAt({ x: -500, y: -500 })).toBeUndefined()
  })
})

describe('duplicating a node', () => {
  it('copies widget values and properties, but not links', () => {
    // `add(type)` only makes a fresh node, so a pack duplicating a prompt box
    // the user had filled in lost its contents.
    setActivePinia(createTestingPinia({ stubActions: false }))
    // Registered, and building its widget in the constructor, because that is
    // what a real node type does: cloning makes a fresh instance from the
    // class and then restores values onto the widgets it created.
    class Dup extends LGraphNode {
      constructor(title?: string) {
        super(title ?? 'Dup')
        // As every ComfyUI node type does: without it `serialize()` writes no
        // widgets_values, and a copy has nothing to restore from.
        this.serialize_widgets = true
        this.addWidget('string', 'text', '', () => {}, {})
      }
    }
    LiteGraph.registerNodeType('DupNode', Dup)
    const graph = new LGraph()
    const source = LiteGraph.createNode('DupNode')!
    graph.add(source)
    source.widgets![0].value = 'a filled prompt'
    source.setProperty('mine', 7)
    const api = createGraphApi(() => graph)

    const copy = api.duplicate(String(source.id), { x: 40, y: 50 })!

    expect(copy.id).not.toBe(String(source.id))
    expect(copy.widgets.get('text')?.getValue()).toBe('a filled prompt')
    expect(copy.getProperty('mine')).toBe(7)
    expect(copy.getPosition()).toEqual({ x: 40, y: 50 })
  })

  it('returns undefined for a node that is not there', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    expect(createGraphApi(() => graph).duplicate('999')).toBeUndefined()
  })
})

function testCanvas(graph: LGraph) {
  const element = document.createElement('canvas')
  element.width = 800
  element.height = 600
  element.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  return new LGraphCanvas(element, graph, {
    skip_events: true,
    skip_render: true
  })
}

describe('selection', () => {
  function twoNodeGraph() {
    const graph = new LGraph()
    const a = new LGraphNode('A', 'TestNode')
    const b = new LGraphNode('B', 'TestNode')
    graph.add(a)
    graph.add(b)
    // The API writes through the canvas, which is what both renderers read.
    LGraphCanvas.active_canvas = testCanvas(graph)
    return { graph, api: createGraphApi(() => graph) }
  }

  it('selects the given nodes and reports them back', () => {
    const { api } = twoNodeGraph()
    const [first] = api.nodes()

    api.select([first])

    expect(api.selection().map((n) => n.id)).toEqual([first.id])
  })

  it('replaces the selection by default and extends it with add', () => {
    const { api } = twoNodeGraph()
    const [first, second] = api.nodes()

    api.select([first])
    api.select([second])
    expect(api.selection().map((n) => n.id)).toEqual([second.id])

    api.select([first], { add: true })
    expect(
      api
        .selection()
        .map((n) => n.id)
        .sort()
    ).toEqual([first.id, second.id].sort())
  })

  it('clears the selection when given no nodes', () => {
    const { api } = twoNodeGraph()
    api.select(api.nodes())
    expect(api.selection()).toHaveLength(2)

    api.select([])

    expect(api.selection()).toHaveLength(0)
  })
})

describe('centering the view on a node', () => {
  it('pans so the node is in the middle, without changing zoom', () => {
    const graph = new LGraph()
    const node = new LGraphNode('T', 'TestNode')
    graph.add(node)
    node.pos = [800, 600]
    const canvas = testCanvas(graph)
    LGraphCanvas.active_canvas = canvas
    const scale = canvas.ds.scale
    const api = createGraphApi(() => graph)

    api.centerOn(api.nodes()[0])

    expect(canvas.ds.offset).not.toEqual([0, 0])
    expect(canvas.ds.scale).toBe(scale)
  })
})

describe('groups', () => {
  it('reports the nodes a group currently contains, recomputed each call', () => {
    // Membership is derived from overlap, not stored: a node dragged out
    // leaves the group with nothing recorded anywhere.
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const inside = new LGraphNode('In', 'TestNode')
    const outside = new LGraphNode('Out', 'TestNode')
    graph.add(inside)
    graph.add(outside)
    inside.pos = [60, 60]
    inside.size = [80, 40]
    outside.pos = [900, 900]
    outside.size = [80, 40]
    const group = new LGraphGroup('Sampling')
    graph.add(group)
    group._bounding.set([20, 20, 400, 300])
    inside.updateArea()
    outside.updateArea()
    const api = createGraphApi(() => graph)

    const [handle] = api.groups()
    expect(handle.getTitle()).toBe('Sampling')
    expect(handle.nodes().map((n) => n.id)).toEqual([String(inside.id)])

    outside.pos = [100, 150]
    outside.updateArea()
    expect(
      handle
        .nodes()
        .map((n) => n.id)
        .sort()
    ).toEqual([String(inside.id), String(outside.id)].sort())
  })

  it('reports the group rectangle and renames it', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const group = new LGraphGroup('Old')
    graph.add(group)
    // After add: registerGroupLayout restores a stored rectangle by group id.
    group._bounding.set([10, 20, 300, 200])
    const [handle] = createGraphApi(() => graph).groups()

    expect(handle.getBounds()).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200
    })

    handle.setTitle('New')
    expect(group.title).toBe('New')
  })
})

describe('zoom', () => {
  it('scales the view', () => {
    // A bookmark saved a zoom level; without a setter the number was inert.
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const canvas = testCanvas(graph)
    LGraphCanvas.active_canvas = canvas
    const api = createGraphApi(() => graph)

    api.setZoom(0.5)

    expect(canvas.ds.scale).toBeCloseTo(0.5)
  })
})

describe('pointer position', () => {
  it('reports the pointer in the coordinates nodeAt uses', () => {
    // A pack adding a node from a menu put it under the cursor; without this
    // the node lands at the graph origin, off screen on any panned view.
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const canvas = testCanvas(graph)
    LGraphCanvas.active_canvas = canvas
    canvas.graph_mouse[0] = 420
    canvas.graph_mouse[1] = 240

    expect(createGraphApi(() => graph).pointerPosition()).toEqual({
      x: 420,
      y: 240
    })
  })

  it('reports nothing when there is no canvas to measure against', () => {
    const previous = LGraphCanvas.active_canvas
    LGraphCanvas.active_canvas = undefined as never
    try {
      expect(
        createGraphApi(() => new LGraph()).pointerPosition()
      ).toBeUndefined()
    } finally {
      LGraphCanvas.active_canvas = previous
    }
  })
})
