import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { SerialisedLLinkArray } from '@comfyorg/graph-model/serialisation'
import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

import { ComfyApiError, ComfyDeletedError } from './errors'
import { createGraphApi } from './graphHandle'
import type { GraphHandle } from './graphHandle'
import type { Supplier } from './resolution'

const previousActiveCanvas = LGraphCanvas.active_canvas

afterEach(() => {
  LGraphCanvas.active_canvas = previousActiveCanvas
  document.querySelectorAll('canvas').forEach((canvas) => canvas.remove())
})

describe('graph API (composed)', () => {
  let graph: LGraph
  let api: GraphHandle

  function addNode(title: string, type: string) {
    const node = new LGraphNode(title, type)
    graph.add(node)
    return node
  }

  beforeEach(() => {
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

  describe('version', () => {
    it('advances when the graph changes and holds still when it does not', () => {
      const before = api.version
      expect(api.version).toBe(before)

      const node = addNode('A', 'Alpha')
      const afterAdd = api.version
      expect(afterAdd).not.toBe(before)

      node.collapse(true)
      expect(api.version).not.toBe(afterAdd)
    })

    it('does not advance when only a widget value changes', () => {
      const node = addNode('A', 'Alpha')
      const widget = node.addWidget('number', 'seed', 1, () => undefined, {})

      const before = api.version
      widget.value = 42

      // Documented on `version`, and load-bearing: packs are told this counter
      // cannot be watched to catch every edit. If litegraph starts bumping on
      // value changes the doc becomes a lie, and this is what says so.
      expect(api.version).toBe(before)
    })

    it('advances for node-handle mutations', () => {
      const node = addNode('A', 'Alpha')
      const handle = api.node(String(node.id))!
      const mutations = [
        () => handle.setCollapsed(true),
        () => handle.setPinned(true),
        () => handle.setTitle('Renamed'),
        () => handle.setMode('never'),
        () => handle.setColor('#123'),
        () => handle.setBgColor('#456'),
        () => handle.setShape('box'),
        () => handle.setSerializeWidgets(true),
        () => handle.setProperty('value', 1),
        () => handle.setPosition({ x: 10, y: 20 }),
        () => handle.setSize({ width: 300, height: 200 })
      ]

      for (const mutate of mutations) {
        const before = api.version
        mutate()
        expect(api.version).not.toBe(before)
      }
    })

    it('coalesces a synchronous batch into one version advance', () => {
      const node = addNode('A', 'Alpha')
      const handle = api.node(String(node.id))!
      const before = api.version

      api.batch(() => {
        handle.setCollapsed(true)
        handle.setPinned(true)
      })

      expect(api.version).toBe(before + 1)
    })

    it('rejects an asynchronous batch callback', () => {
      expect(() => api.batch(async () => undefined)).toThrow(/synchronous/)
    })

    it('refuses an async batch callback before any of it runs', async () => {
      const node = new LGraphNode('before')
      graph.add(node)
      const handle = api.node(String(node.id))!
      const started = vi.fn()

      expect(() =>
        api.batch(async () => {
          started()
          await Promise.resolve()
          handle.setTitle('escaped')
        })
      ).toThrow(/synchronous/)
      await Promise.resolve()
      await Promise.resolve()

      expect(started).not.toHaveBeenCalled()
      expect(node.title).toBe('before')
    })

    it('advances when a value is committed through the API', () => {
      // The contrast with the raw write above is the contract: a bare
      // `widget.value =` is a silent restore, `setValue` is a user-grade
      // commit, and packs watching `version` must see the latter.
      const node = addNode('A', 'Alpha')
      node.addWidget('number', 'seed', 1, () => undefined, {})

      const before = api.version
      api.node(String(node.id))!.widgets.get('seed')!.setValue(42)

      expect(api.version).not.toBe(before)
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
    const graph = new LGraph()
    expect(createGraphApi(() => graph).duplicate('999')).toBeUndefined()
  })
})

describe('replacing a node', () => {
  let graph: LGraph
  let api: GraphHandle

  class Small extends LGraphNode {
    static override title = 'Small'
    constructor() {
      super('Small', 'Small')
      this.addInput('ctx', 'CTX')
      this.addOutput('ctx', 'CTX')
      this.addOutput('model', 'MODEL')
      this.addWidget('number', 'seed', 1, () => {})
      this.addProperty('shared', 'kept')
    }
  }
  class Big extends LGraphNode {
    static override title = 'Big'
    constructor() {
      super('Big', 'Big')
      this.addInput('ctx', 'CTX')
      // 'model' moved behind a new slot: an index match would wire it to the
      // wrong place, which is why the name is tried first.
      this.addOutput('ctx', 'CTX')
      this.addOutput('clip', 'CLIP')
      this.addOutput('model', 'MODEL')
      this.addWidget('number', 'seed', 1, () => {})
      this.addProperty('shared', 'default')
    }
  }
  class Peer extends LGraphNode {
    constructor() {
      super('Peer', 'Peer')
      this.addInput('ctx', 'CTX')
      this.addInput('model', 'MODEL')
      this.addOutput('ctx', 'CTX')
    }
  }

  beforeEach(() => {
    LiteGraph.registerNodeType('Small', Small)
    LiteGraph.registerNodeType('Big', Big)
    LiteGraph.registerNodeType('Peer', Peer)
    graph = new LGraph()
    api = createGraphApi(() => graph)
  })

  function small() {
    const node = LiteGraph.createNode('Small')!
    graph.add(node)
    return node
  }

  it('becomes the new type and keeps where the user put it', () => {
    const node = small()
    node.pos = [120, 340]

    const swapped = api.replace(String(node.id), 'Big')!

    expect(swapped.type).toBe('Big')
    expect(swapped.getPosition()).toEqual({ x: 120, y: 340 })
    expect(graph.getNodeById(node.id)).toBeFalsy()
  })

  it('re-makes the links by name, not by index', () => {
    // 'model' is output 1 on Small and output 2 on Big. Matching by index
    // would silently wire the peer's MODEL input to a CLIP slot, or nothing.
    const node = small()
    const upstream = LiteGraph.createNode('Peer')!
    const downstream = LiteGraph.createNode('Peer')!
    graph.add(upstream)
    graph.add(downstream)
    upstream.connect(0, node, 'ctx')
    node.connect('model', downstream, 'model')

    const swapped = api.replace(String(node.id), 'Big')!
    const replaced = graph.getNodeById(toNodeId(swapped.id))!

    expect(replaced.inputs[0].link).not.toBeNull()
    expect(replaced.findOutputSlot('model')).toBe(2)
    expect(downstream.inputs[1].link).not.toBeNull()
  })

  it('works when the pack destructures it off the handle', () => {
    // The surface is a frozen literal, so `const { replace } = comfy.graph` is
    // ordinary use; a method reaching for `this` threw a TypeError there.
    const node = small()
    const { replace } = api

    expect(() => replace(String(node.id), 'Big')).not.toThrow()
  })

  it('matches an input by name against inputs only', () => {
    class Renamed extends LGraphNode {
      constructor() {
        super('Renamed', 'Renamed')
        this.addInput('ctx', 'CTX')
        this.addInput('model', 'MODEL')
      }
    }
    class RenamedTo extends LGraphNode {
      constructor() {
        super('RenamedTo', 'RenamedTo')
        this.addInput('ctx', 'CTX')
        this.addInput('checkpoint', 'MODEL')
        this.addOutput('model', 'MODEL')
      }
    }
    LiteGraph.registerNodeType('Renamed', Renamed)
    LiteGraph.registerNodeType('RenamedTo', RenamedTo)
    const node = LiteGraph.createNode('Renamed')!
    const upstream = LiteGraph.createNode('Small')!
    graph.add(node)
    graph.add(upstream)
    upstream.connect('model', node, 'model')

    const swapped = api.replace(String(node.id), 'RenamedTo')!
    const replaced = graph.getNodeById(toNodeId(swapped.id))!

    expect(replaced.inputs[1].link).not.toBeNull()
  })

  it('carries widget values across', () => {
    // Neither pack that ships this feature does. Swapping a sampler for its
    // advanced form and losing the seed the user typed is a bug, not a policy.
    const node = small()
    node.widgets![0].value = 42

    const swapped = api.replace(String(node.id), 'Big')!

    expect(swapped.widgets.get('seed')?.getValue()).toBe(42)
  })

  it('rebuilds the same type without losing values or links', () => {
    const node = small()
    const upstream = LiteGraph.createNode('Peer')!
    const downstream = LiteGraph.createNode('Peer')!
    graph.add(upstream)
    graph.add(downstream)
    upstream.connect('ctx', node, 'ctx')
    node.connect('model', downstream, 'model')
    node.widgets![0].value = 42
    const originalId = String(node.id)

    const rebuilt = api.replace(originalId, 'Small')!

    expect(rebuilt.id).not.toBe(originalId)
    expect(api.node(originalId)).toBeUndefined()
    expect(rebuilt.widgets.get('seed')?.getValue()).toBe(42)
    expect(rebuilt.inputs.byName('ctx')?.source()?.nodeId).toBe(
      String(upstream.id)
    )
    expect(rebuilt.outputs.byName('model')?.targets()).toContainEqual({
      nodeId: String(downstream.id),
      inputIndex: 1
    })
  })

  it('carries a title the user chose, but not the old type name', () => {
    const renamed = small()
    renamed.title = 'My context'
    const untouched = small()

    expect(api.replace(String(renamed.id), 'Big')!.getTitle()).toBe(
      'My context'
    )
    expect(api.replace(String(untouched.id), 'Big')!.getTitle()).toBe('Big')
  })

  it('carries a property the new type declares', () => {
    const node = small()
    node.setProperty('shared', 'mine')

    expect(api.replace(String(node.id), 'Big')!.getProperty('shared')).toBe(
      'mine'
    )
  })

  it('keeps a width the user chose, and grows a height the new type needs', () => {
    const widened = small()
    widened.size = [600, 10]
    const squashed = small()
    squashed.size = [10, 10]

    const kept = graph.getNodeById(
      toNodeId(api.replace(String(widened.id), 'Big')!.id)
    )!
    const grown = graph.getNodeById(
      toNodeId(api.replace(String(squashed.id), 'Big')!.id)
    )!

    expect(kept.size[0]).toBe(600)
    // Big has an extra output; keeping the old height verbatim clips it.
    expect(grown.size[1]).toBe(grown.computeSize()[1])
  })

  it('warns about a link the new type cannot take', () => {
    const warn = vi.mocked(console.warn)
    const node = small()
    const downstream = LiteGraph.createNode('Peer')!
    graph.add(downstream)
    node.connect('model', downstream, 'model')

    api.replace(String(node.id), 'Peer')

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("output 'model'"))
    warn.mockRestore()
  })

  function smallInsideSubgraph() {
    const subgraph = createTestSubgraph({
      rootGraph: graph,
      inputs: [
        { name: 'seed', type: 'INT' },
        { name: 'ctx', type: 'CTX' }
      ],
      outputs: [
        { name: 'mask', type: 'MASK' },
        { name: 'ctx', type: 'CTX' }
      ]
    })
    graph.subgraphs.set(subgraph.id, subgraph)
    const node = LiteGraph.createNode('Small')!
    subgraph.add(node)
    subgraph.inputNode.slots[1].connect(node.inputs[0], node)
    subgraph.outputNode.slots[1].connect(node.outputs[0], node)
    return { subgraph, node, inner: createGraphApi(() => subgraph) }
  }

  it("keeps the links to the subgraph's own input and output", () => {
    const { subgraph, node, inner } = smallInsideSubgraph()

    const rebuilt = inner.replace(String(node.id), 'Small')!
    const input = rebuilt.inputs.byName('ctx')!
    const output = rebuilt.outputs.byName('ctx')!

    expect(input.source()).toEqual({
      nodeId: String(SUBGRAPH_INPUT_ID),
      outputIndex: 1
    })
    expect(output.targets()).toEqual([
      { nodeId: String(SUBGRAPH_OUTPUT_ID), inputIndex: 1 }
    ])
    expect(subgraph.inputs[1].linkIds.map(String)).toEqual([input.link()!.id])
    expect(subgraph.outputs[1].linkIds.map(String)).toEqual([
      output.links()[0].id
    ])
  })

  it('drops and warns about a subgraph boundary link the new type cannot take', () => {
    class Retyped extends LGraphNode {
      constructor() {
        super('Retyped', 'Retyped')
        this.addInput('ctx', 'MODEL')
        this.addOutput('ctx', 'MODEL')
      }
    }
    LiteGraph.registerNodeType('Retyped', Retyped)
    const warn = vi.mocked(console.warn)
    const { subgraph, node, inner } = smallInsideSubgraph()

    const swapped = inner.replace(String(node.id), 'Retyped')!

    expect(swapped.inputs.byName('ctx')!.isConnected).toBe(false)
    expect(swapped.outputs.byName('ctx')!.isConnected).toBe(false)
    expect(subgraph.inputs[1].linkIds).toEqual([])
    expect(subgraph.outputs[1].linkIds).toEqual([])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("input 'ctx', output 'ctx'")
    )
  })

  it.for([
    {
      side: 'input',
      link: (id: string): SerialisedLLinkArray => [9, 99, 0, id, 0, 'CTX']
    },
    {
      side: 'output',
      link: (id: string): SerialisedLLinkArray => [9, id, 0, 99, 0, 'CTX']
    }
  ])('still replaces a node whose $side link has no other end', ({ link }) => {
    const broken = small()
    const saved = graph.serialize()
    saved.links = [link(broken.id)]
    graph.configure(saved)
    expect(graph.links.size).toBe(1)

    expect(api.replace(broken.id, 'Big')?.type).toBe('Big')
    expect(api.node(broken.id)?.type).not.toBe('Small')
  })

  it('is one undo step', () => {
    // Not a call count: graph.remove opens its own scope, and nesting is fine
    // because ChangeTracker counts. What must hold is that the count returns
    // to zero exactly once, at the very end — that is the single capture.
    const canvas = testCanvas(graph)
    LGraphCanvas.active_canvas = canvas
    let depth = 0
    let captures = 0
    canvas.onBeforeChange = () => depth++
    canvas.onAfterChange = () => {
      if (--depth === 0) captures++
    }

    api.replace(String(small().id), 'Big')

    expect(depth).toBe(0)
    expect(captures).toBe(1)
  })

  it('returns undefined for a node that is not there', () => {
    expect(api.replace('999', 'Big')).toBeUndefined()
  })

  it('refuses a type that is not registered', () => {
    expect(() => api.replace(String(small().id), 'Nope')).toThrow(ComfyApiError)
  })
})

function testCanvas(graph: LGraph) {
  const element = document.createElement('canvas')
  // Parented: LGraph.remove reaches checkPanels, which throws without one.
  document.body.appendChild(element)
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
    const selectedIds = api.selection().map((n) => n.id)
    expect(selectedIds).toHaveLength(2)
    expect(selectedIds).toEqual(expect.arrayContaining([first.id, second.id]))
  })

  it('reports the active canvas, not the first one on the graph', () => {
    const { graph, api } = twoNodeGraph()
    const stale = LGraphCanvas.active_canvas
    LGraphCanvas.active_canvas = testCanvas(graph)
    const [first] = api.nodes()

    api.select([first])

    expect(stale).not.toBe(LGraphCanvas.active_canvas)
    expect(api.selection().map((n) => n.id)).toEqual([first.id])
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
    node.size = [200, 100]
    const canvas = testCanvas(graph)
    LGraphCanvas.active_canvas = canvas
    canvas.ds.scale = 2
    canvas.dpr = 2
    const api = createGraphApi(() => graph)

    api.centerOn(api.nodes()[0])

    expect(canvas.ds.offset).toEqual([-800, -575])
    expect(canvas.ds.scale).toBe(2)
  })
})

describe('groups', () => {
  it('returns a stable handle for the same group', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('Sampling')
    graph.add(group)
    const api = createGraphApi(() => graph)

    expect(api.groups()[0]).toBe(api.groups()[0])
  })

  it('reports the nodes a group currently contains, recomputed each call', () => {
    // Membership is derived from overlap, not stored: a node dragged out
    // leaves the group with nothing recorded anywhere.
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
    const nodeIds = handle.nodes().map((n) => n.id)
    expect(nodeIds).toHaveLength(2)
    expect(nodeIds).toEqual(
      expect.arrayContaining([String(inside.id), String(outside.id)])
    )
  })

  it('reports the group rectangle and renames it', () => {
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

  it('keeps a kept group through undo and retires it once deleted', () => {
    const graph = new LGraph()
    graph.add(new LGraphGroup('Sampling'))
    const [kept] = createGraphApi(() => graph).groups()

    graph.configure(graph.serialize())
    kept.setTitle('Renamed')

    expect(kept.isDeleted).toBe(false)
    expect(graph.groups[0].title).toBe('Renamed')

    graph.remove(graph.groups[0])

    expect(kept.isDeleted).toBe(true)
    expect(kept.getTitle()).toBe('')
    expect(() => kept.setTitle('Gone')).toThrow(ComfyDeletedError)
  })

  it("lists a kept group's nodes from the group's own graph", () => {
    const first = new LGraph()
    const second = new LGraph()
    const member = new LGraphNode('member', 'TestNode')
    const sameId = new LGraphNode('same id elsewhere', 'TestNode')
    first.add(member)
    second.add(sameId)
    member.pos = [60, 60]
    member.size = [80, 40]
    const group = new LGraphGroup('Sampling')
    first.add(group)
    group._bounding.set([20, 20, 400, 300])
    member.updateArea()
    let active = first
    const api = createGraphApi(() => active)
    const [kept] = api.groups()

    active = second

    expect(sameId.id).toBe(member.id)
    expect(kept.nodes().map((node) => node.getTitle())).toEqual(['member'])
  })

  it('centers on a kept group only while its graph is on screen', () => {
    const first = new LGraph()
    const second = new LGraph()
    const group = new LGraphGroup('Sampling')
    first.add(group)
    group._bounding.set([1000, 1000, 200, 100])
    const [kept] = createGraphApi(() => first).groups()
    const elsewhere = testCanvas(second)
    LGraphCanvas.active_canvas = elsewhere

    kept.centerOn()

    expect([...elsewhere.ds.offset]).toEqual([0, 0])

    const onScreen = testCanvas(first)
    LGraphCanvas.active_canvas = onScreen

    kept.centerOn()

    expect([...onScreen.ds.offset]).toEqual([-700, -750])
  })
})

describe('zoom', () => {
  it('scales the view', () => {
    // A bookmark saved a zoom level; without a setter the number was inert.
    const graph = new LGraph()
    const canvas = testCanvas(graph)
    LGraphCanvas.active_canvas = canvas
    const api = createGraphApi(() => graph)

    api.setZoom(0.5)

    expect(canvas.ds.scale).toBeCloseTo(0.5)
  })
})

describe('panning', () => {
  it('pans by a screen distance that does not depend on zoom', () => {
    const graph = new LGraph()
    const canvas = testCanvas(graph)
    LGraphCanvas.active_canvas = canvas
    canvas.ds.scale = 2
    canvas.ds.offset = [10, 20]
    const api = createGraphApi(() => graph)

    api.panBy({ x: 100, y: -50 })

    expect([...canvas.ds.offset]).toEqual([60, -5])
    expect(canvas.ds.scale).toBe(2)
  })

  it('refuses a distance that is not finite and leaves the view alone', () => {
    const graph = new LGraph()
    const canvas = testCanvas(graph)
    LGraphCanvas.active_canvas = canvas
    const api = createGraphApi(() => graph)

    expect(() => api.panBy({ x: Number.NaN, y: 0 })).toThrow(TypeError)
    expect([...canvas.ds.offset]).toEqual([0, 0])
  })

  it('does nothing without a canvas', () => {
    LGraphCanvas.active_canvas = undefined as never
    const api = createGraphApi(() => new LGraph())

    expect(() => api.panBy({ x: 5, y: 5 })).not.toThrow()
  })
})

describe('querying nodes', () => {
  function nested() {
    const root = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: root, name: 'Inner' })
    root.subgraphs.set(subgraph.id, subgraph)
    const outer = new LGraphNode('outer', 'Mine/A')
    root.add(outer)
    const inner = new LGraphNode('inner', 'Mine/B')
    const other = new LGraphNode('other', 'Theirs')
    subgraph.add(inner)
    subgraph.add(other)
    return { root, subgraph, api: createGraphApi(() => subgraph) }
  }
  const titles = (nodes: readonly { getTitle(): string }[]) =>
    nodes.map((node) => node.getTitle())

  it('returns the graph on screen by default, as nodes() does', () => {
    const { api } = nested()

    const found = api.queryNodes()

    expect(titles(found)).toEqual(['inner', 'other'])
    expect(found[0]).toBe(api.node(found[0].id))
  })

  it('reaches the root and every subgraph, each node in its own graph', () => {
    const { root, subgraph, api } = nested()

    const found = api.queryNodes({
      scope: 'root-and-subgraphs',
      type: /^Mine\//
    })

    expect(found.map((node) => [node.graphId, node.getTitle()])).toEqual([
      [root.id, 'outer'],
      [subgraph.id, 'inner']
    ])
  })

  it.for([
    { name: 'an exact type', type: 'Theirs', expected: ['other'] },
    {
      name: 'any of several types',
      type: ['Mine/A', 'Theirs'],
      expected: ['outer', 'other']
    },
    {
      name: 'a pattern reused across calls',
      type: /mine/gi,
      expected: ['outer', 'inner']
    }
  ])('narrows by $name', ({ type, expected }) => {
    const { api } = nested()
    const query = { scope: 'root-and-subgraphs', type } as const

    expect(titles(api.queryNodes(query))).toEqual(expected)
    expect(titles(api.queryNodes(query))).toEqual(expected)
  })

  it('keeps only nodes in the graph on screen when asked for rendered ones', () => {
    const { api } = nested()

    expect(
      titles(api.queryNodes({ scope: 'root-and-subgraphs', rendered: true }))
    ).toEqual(['inner', 'other'])
  })

  it('keeps only nodes a group contains, combined with the type', () => {
    const graph = new LGraph()
    const inside = new LGraphNode('inside', 'Mine/A')
    const alsoInside = new LGraphNode('also inside', 'Theirs')
    const outside = new LGraphNode('outside', 'Mine/A')
    graph.add(inside)
    graph.add(alsoInside)
    graph.add(outside)
    inside.pos = [60, 60]
    alsoInside.pos = [60, 160]
    outside.pos = [900, 900]
    inside.size = [80, 40]
    alsoInside.size = [80, 40]
    outside.size = [80, 40]
    inside.updateArea()
    alsoInside.updateArea()
    outside.updateArea()
    const box = new LGraphGroup('Box')
    graph.add(box)
    box._bounding.set([20, 20, 400, 300])
    const api = createGraphApi(() => graph)
    const [group] = api.groups()

    expect(titles(api.queryNodes({ group }))).toEqual(['inside', 'also inside'])
    expect(titles(api.queryNodes({ group, type: 'Mine/A' }))).toEqual([
      'inside'
    ])
  })

  it('refuses a scope it does not know', () => {
    const { api } = nested()

    expect(() =>
      Reflect.apply(api.queryNodes, api, [{ scope: 'everywhere' }])
    ).toThrow(TypeError)
  })
})

describe('pointer position', () => {
  it('reports the pointer in the coordinates nodeAt uses', () => {
    // A pack adding a node from a menu put it under the cursor; without this
    // the node lands at the graph origin, off screen on any panned view.
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

describe('subgraphs', () => {
  function documentWithSubgraph() {
    const root = new LGraph()
    const top = new LGraphNode('Top', 'TestNode')
    root.add(top)

    const subgraph = createTestSubgraph({ rootGraph: root, name: 'Upscale' })
    root.subgraphs.set(subgraph.id, subgraph)

    const inner = new LGraphNode('Inner', 'TestNode')
    subgraph.add(inner)
    return { root, top, subgraph, inner }
  }

  it('reaches nodes the active graph cannot see', () => {
    const { root, subgraph, inner } = documentWithSubgraph()
    const api = createGraphApi(() => root)

    expect(api.nodes().map((n) => n.type)).toEqual(['TestNode'])

    const [nested] = api.subgraphs()
    expect(nested.id).toBe(subgraph.id)
    expect(nested.name).toBe('Upscale')
    expect(nested.node(String(inner.id))?.id).toBe(String(inner.id))
  })

  it('reaches the root while a subgraph is active', () => {
    const { root, top, subgraph, inner } = documentWithSubgraph()
    const api = createGraphApi(() => subgraph)

    expect(api.nodes().map((node) => node.getTitle())).toEqual(['Inner'])
    expect(api.root()?.id).toBe(root.id)
    expect(api.root()?.node(String(top.id))?.getTitle()).toBe('Top')
    expect(api.root()?.node(String(inner.id))).toBeUndefined()
  })

  it('lists every link while a subgraph is active, including those at its boundary, but no floating link', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'seed', type: 'INT' },
        { name: 'image', type: 'IMAGE' }
      ],
      outputs: [
        { name: 'mask', type: 'MASK' },
        { name: 'image', type: 'IMAGE' }
      ]
    })
    const [first, second] = ['First', 'Second'].map((title) => {
      const relay = new LGraphNode(title, 'Relay')
      relay.addInput('in', 'IMAGE')
      relay.addOutput('out', 'IMAGE')
      subgraph.add(relay)
      return relay
    })
    subgraph.inputNode.slots[1].connect(first.inputs[0], first)
    first.connect(0, second, 0)
    subgraph.outputNode.slots[1].connect(second.outputs[0], second)
    second.connectFloatingReroute([0, 0], second.outputs[0])
    expect(subgraph.floatingLinks.size).toBe(1)

    const links = createGraphApi(() => subgraph).links()

    expect(links).toHaveLength(3)
    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: String(SUBGRAPH_INPUT_ID),
          sourceIndex: 1,
          targetNodeId: String(first.id)
        }),
        expect.objectContaining({
          sourceNodeId: String(first.id),
          targetNodeId: String(second.id)
        }),
        expect.objectContaining({
          sourceNodeId: String(second.id),
          targetNodeId: String(SUBGRAPH_OUTPUT_ID),
          targetIndex: 1
        })
      ])
    )
  })

  it('reports the groups drawn inside a subgraph', () => {
    // A group muter that skipped these reported nothing for a subgraph's
    // contents while appearing to work.
    const { root, subgraph } = documentWithSubgraph()
    const group = new LGraphGroup('Nested')
    subgraph.add(group)

    const [nested] = createGraphApi(() => root).subgraphs()

    expect(nested.groups().map((g) => g.getTitle())).toEqual(['Nested'])
  })

  it('resolves each id inside its own graph, not across them', () => {
    // Ids come from the root graph's counter, so they do not collide in one
    // session — but a subgraph loaded from a file brings its authored ids and
    // configure raises the counter without renumbering, so two independently
    // authored subgraphs can carry the same id. Scoping is what makes lookup
    // correct without relying on that.
    const { root, top, inner } = documentWithSubgraph()
    const api = createGraphApi(() => root)
    const nested = api.subgraphs()[0]

    expect(api.node(String(top.id))?.getTitle()).toBe('Top')
    expect(nested.node(String(inner.id))?.getTitle()).toBe('Inner')

    // Neither graph answers for the other's node.
    expect(api.node(String(inner.id))).toBeUndefined()
    expect(nested.node(String(top.id))).toBeUndefined()
  })
})

describe('batching mutations into one undo step', () => {
  function trackedGraph() {
    const graph = new LGraph()
    const canvas = testCanvas(graph)
    LGraphCanvas.active_canvas = canvas
    const calls: string[] = []
    canvas.onBeforeChange = () => calls.push('before')
    canvas.onAfterChange = () => calls.push('after')
    return { graph, calls, api: createGraphApi(() => graph) }
  }

  it('opens and closes one scope around the mutations', () => {
    const { graph, calls, api } = trackedGraph()

    const added = api.batch(() => {
      graph.add(new LGraphNode('One'))
      graph.add(new LGraphNode('Two'))
      return 'done'
    })

    expect(added).toBe('done')
    expect(api.nodes()).toHaveLength(2)
    expect(calls).toEqual(['before', 'after'])
  })

  it('closes the scope when the mutations throw', () => {
    // The counter only captures on returning to zero, so an unbalanced scope
    // stops undo recording anything for the rest of the session.
    const { calls, api } = trackedGraph()

    expect(() =>
      api.batch(() => {
        throw new Error('pack blew up')
      })
    ).toThrow('pack blew up')

    expect(calls).toEqual(['before', 'after'])
  })
})

describe('resolved supplies', () => {
  function apiWithSuppliers(
    graph: LGraph,
    suppliers: ReadonlyMap<string, Supplier>
  ): GraphHandle {
    return Reflect.apply(createGraphApi, undefined, [
      () => graph,
      '',
      () => new Map(),
      () => suppliers
    ]) as GraphHandle
  }

  function addBroadcaster(graph: LGraph) {
    const node = new LGraphNode('Broadcaster', 'Broadcaster')
    node.addOutput('model', 'MODEL')
    graph.add(node)
    return node
  }

  it('exposes the winning supplier and its final graph-local edge', () => {
    const graph = new LGraph()
    const quiet = addBroadcaster(graph)
    const loud = addBroadcaster(graph)
    const sink = new LGraphNode('Sink', 'Sink')
    sink.addInput('model', 'MODEL')
    graph.add(sink)
    const supplier: Supplier = (view) =>
      view.unconnectedInputs().map((input) => ({
        to: { nodeId: input.nodeId, input: input.input },
        from: { output: 0 },
        priority: view.self.id === String(loud.id) ? 10 : 1
      }))
    const api = apiWithSuppliers(graph, new Map([['Broadcaster', supplier]]))

    const supplies = api.resolvedSupplies()
    expect(supplies).toEqual([
      {
        supplierNodeId: String(loud.id),
        to: { nodeId: String(sink.id), input: 0 },
        from: { kind: 'output', nodeId: String(loud.id), output: 0 }
      }
    ])
    expect(String(quiet.id)).not.toBe(String(loud.id))
    expect(Object.isFrozen(supplies)).toBe(true)
    expect(Object.isFrozen(supplies[0])).toBe(true)
    expect(Object.isFrozen(supplies[0].to)).toBe(true)
    expect(Object.isFrozen(supplies[0].from)).toBe(true)
  })

  it('reports no edge when the winning priority is tied', () => {
    const warn = vi.mocked(console.warn)
    const graph = new LGraph()
    addBroadcaster(graph)
    addBroadcaster(graph)
    const sink = new LGraphNode('Sink', 'Sink')
    sink.addInput('model', 'MODEL')
    graph.add(sink)
    const supplier: Supplier = (view) =>
      view.unconnectedInputs().map((input) => ({
        to: { nodeId: input.nodeId, input: input.input },
        from: { output: 0 }
      }))
    const api = apiWithSuppliers(graph, new Map([['Broadcaster', supplier]]))

    expect(api.resolvedSupplies()).toEqual([])
    expect(warn).toHaveBeenCalledOnce()
  })
})
