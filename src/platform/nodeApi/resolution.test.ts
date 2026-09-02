/**
 * The proving cases for frontend-node resolution: Reroute and SetNode/GetNode,
 * declared through `defs.define` and resolved by the pure pass — the two
 * archetypes `applyToGraph` existed for.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from './comfyApi'
import type { Comfy } from './comfyApi'
import { createDefRegistry, frontendResolverMap } from './defsRegistry'
import type { DefRegistry } from './defsRegistry'
import { resolveFrontendNodes, resolveSuppliedInputs } from './resolution'
import type { SupplyView, Supplier, UnconnectedInput } from './resolution'

describe('frontend-node resolution', () => {
  let graph: LGraph
  let defs: DefRegistry
  let comfy: Comfy
  const cleanups: (() => void)[] = []

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()
    comfy = createComfyApi(() => graph)
    defs = createDefRegistry().forMajor((id) => comfy.graph.node(id)!)

    class TestSource extends LGraphNode {
      constructor() {
        super('TestSource')
        this.addOutput('out', '*')
      }
    }
    LiteGraph.registerNodeType('TestSource', TestSource)
    cleanups.push(() => LiteGraph.unregisterNodeType('TestSource'))
  })

  afterEach(() => {
    while (cleanups.length) cleanups.pop()!()
  })

  const spawn = (type: string) => {
    const node = LiteGraph.createNode(type)!
    graph.add(node)
    return node
  }

  const defineReroute = () =>
    cleanups.push(
      defs.define({
        type: 'TestReroute',
        execution: 'frontend',
        inputs: [{ name: 'in', type: '*' }],
        outputs: [{ name: 'out', type: '*' }],
        resolve: ({ self }) => ({ out: { forwardTo: self.input('in')! } })
      })
    )

  it('resolves a reroute chain to the real source', () => {
    defineReroute()
    const source = spawn('TestSource')
    const r1 = spawn('TestReroute')
    const r2 = spawn('TestReroute')
    source.connect(0, r1, 0)
    r1.connect(0, r2, 0)

    const resolved = resolveFrontendNodes(graph, frontendResolverMap())
    expect(resolved.get(`${r2.id}:0`)).toEqual({
      kind: 'output',
      nodeId: String(source.id),
      output: 0
    })
  })

  it('resolves GetNode to the source feeding its matching SetNode', () => {
    cleanups.push(
      defs.define({
        type: 'TestSetNode',
        execution: 'frontend',
        inputs: [{ name: 'value', type: '*' }],
        widgets: [{ type: 'string', name: 'key', value: '' }]
      })
    )
    cleanups.push(
      defs.define({
        type: 'TestGetNode',
        execution: 'frontend',
        outputs: [{ name: 'value', type: '*' }],
        widgets: [{ type: 'string', name: 'key', value: '' }],
        resolve: ({ self, nodesOfType }) => {
          const wanted = self.widgetValue('key')
          const setter = nodesOfType('TestSetNode').find(
            (candidate) => candidate.widgetValue('key') === wanted
          )
          return {
            value: setter
              ? { forwardTo: setter.input('value')! }
              : { omit: true }
          }
        }
      })
    )

    const source = spawn('TestSource')
    const setter = spawn('TestSetNode')
    const getter = spawn('TestGetNode')
    source.connect(0, setter, 0)
    setter.widgets!.find((w) => w.name === 'key')!.value = 'latents'
    getter.widgets!.find((w) => w.name === 'key')!.value = 'latents'

    const resolved = resolveFrontendNodes(graph, frontendResolverMap())
    expect(resolved.get(`${getter.id}:0`)).toEqual({
      kind: 'output',
      nodeId: String(source.id),
      output: 0
    })
  })

  it('omits a GetNode whose key matches no SetNode, without failing the pass', () => {
    cleanups.push(
      defs.define({
        type: 'TestGetNode',
        execution: 'frontend',
        outputs: [{ name: 'value', type: '*' }],
        widgets: [{ type: 'string', name: 'key', value: 'orphan' }],
        resolve: () => ({ value: { omit: true } })
      })
    )
    const getter = spawn('TestGetNode')
    const resolved = resolveFrontendNodes(graph, frontendResolverMap())
    expect(resolved.get(`${getter.id}:0`)?.kind).toBe('omitted')
  })

  it('terminates on a cycle and marks it, rather than hanging', () => {
    defineReroute()
    const r1 = spawn('TestReroute')
    const r2 = spawn('TestReroute')
    r1.connect(0, r2, 0)
    r2.connect(0, r1, 0)

    const resolved = resolveFrontendNodes(graph, frontendResolverMap())
    const outcome = resolved.get(`${r1.id}:0`)
    expect(outcome?.kind).toBe('omitted')
    expect((outcome as { reason: string }).reason).toMatch(/cycle/)
  })

  it('leaves the graph untouched even when a resolver throws', () => {
    // The property applyToGraph structurally cannot have: it mutates the live
    // graph as it goes, so a throw halfway leaves the document corrupted.
    cleanups.push(
      defs.define({
        type: 'TestBroken',
        execution: 'frontend',
        outputs: [{ name: 'out', type: '*' }],
        resolve: () => {
          throw new Error('resolver bug')
        }
      })
    )
    spawn('TestBroken')
    const before = JSON.stringify(graph.serialize())

    expect(() => resolveFrontendNodes(graph, frontendResolverMap())).toThrow(
      'resolver bug'
    )
    expect(JSON.stringify(graph.serialize())).toBe(before)
  })

  it('keeps a defined frontend node out of executable output via the legacy flag', () => {
    // Until the prompt builder consumes the resolution map directly, the
    // current serializer's isVirtualNode check is what omits these nodes —
    // define() sets it, without ever exposing applyToGraph.
    defineReroute()
    const reroute = spawn('TestReroute')
    expect(reroute.isVirtualNode).toBe(true)
    expect((reroute as { applyToGraph?: unknown }).applyToGraph).toBeUndefined()
  })
})

describe('supply-side resolution', () => {
  let graph: LGraph
  const cleanups: (() => void)[] = []

  beforeEach(() => {
    setActivePinia(createPinia())
    graph = new LGraph()

    class Broadcaster extends LGraphNode {
      constructor() {
        super('Broadcaster')
        this.addOutput('out', '*')
      }
    }
    class Sink extends LGraphNode {
      constructor() {
        super('Sink')
        this.addInput('model', 'MODEL')
        this.addInput('clip', 'CLIP')
      }
    }
    LiteGraph.registerNodeType('Broadcaster', Broadcaster)
    LiteGraph.registerNodeType('Sink', Sink)
    cleanups.push(() => LiteGraph.unregisterNodeType('Broadcaster'))
    cleanups.push(() => LiteGraph.unregisterNodeType('Sink'))
  })

  afterEach(() => {
    while (cleanups.length) cleanups.pop()!()
  })

  const spawn = (type: string) => {
    const node = LiteGraph.createNode(type)!
    graph.add(node)
    return node
  }

  /** cg-use-everywhere in miniature: feed every unfed MODEL input. */
  const broadcastModel: Supplier = (view) =>
    view
      .unconnectedInputs()
      .filter((i) => i.type === 'MODEL')
      .map((i) => ({
        to: { nodeId: i.nodeId, input: i.input },
        from: { output: 0 }
      }))

  const supply = (suppliers: Map<string, Supplier>) =>
    resolveSuppliedInputs(graph, suppliers, new Map())

  it('feeds an input nothing is connected to — what a resolver cannot do', () => {
    const source = spawn('Broadcaster')
    const sink = spawn('Sink')

    const supplied = supply(new Map([['Broadcaster', broadcastModel]]))

    expect(supplied.get(`${sink.id}:0`)).toEqual({
      kind: 'output',
      nodeId: String(source.id),
      output: 0
    })
  })

  it('leaves an input that already has a link alone', () => {
    const source = spawn('Broadcaster')
    const sink = spawn('Sink')
    source.connect(0, sink, 0)

    const supplied = supply(new Map([['Broadcaster', broadcastModel]]))

    expect(supplied.has(`${sink.id}:0`)).toBe(false)
  })

  it('only claims the inputs the supplier matched', () => {
    const sink = spawn('Sink')
    spawn('Broadcaster')

    const supplied = supply(new Map([['Broadcaster', broadcastModel]]))

    // `clip` is CLIP, so the MODEL broadcaster must not touch it.
    expect(supplied.has(`${sink.id}:1`)).toBe(false)
  })

  it('feeds nothing when two suppliers claim an input equally', () => {
    // Two broadcasters both matching has no correct answer. Picking either
    // makes the prompt depend on node order, so the same workflow could queue
    // differently after an unrelated edit. The broadcast pack this exists for
    // reports the ambiguity and leaves the input alone; so do we.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    spawn('Broadcaster')
    spawn('Broadcaster')
    const sink = spawn('Sink')

    const supplied = supply(new Map([['Broadcaster', broadcastModel]]))

    expect(supplied.get(`${sink.id}:0`)).toBeUndefined()
    expect(warn.mock.calls[0][0]).toContain('leaving it unfed')
  })

  it('gives the input to the highest priority claim', () => {
    const quiet = spawn('Broadcaster')
    const loud = spawn('Broadcaster')
    const sink = spawn('Sink')

    const supplied = supply(
      new Map<string, Supplier>([
        [
          'Broadcaster',
          (view) =>
            view
              .unconnectedInputs()
              .filter((i) => i.type === 'MODEL')
              .map((i) => ({
                to: { nodeId: i.nodeId, input: i.input },
                from: { output: 0 },
                priority: view.self.id === String(loud.id) ? 10 : 1
              }))
        ]
      ])
    )

    expect(supplied.get(`${sink.id}:0`)).toMatchObject({
      nodeId: String(loud.id)
    })
    expect(String(quiet.id)).not.toBe(String(loud.id))
  })

  it('reports which groups a candidate and the supplier are in', () => {
    // Broadcast packs restrict by group — "only nodes in my group", "only
    // nodes outside it", "only groups whose title matches". Membership is
    // geometric, so it is recomputed rather than read from anything stored.
    const broadcaster = spawn('Broadcaster')
    const sink = spawn('Sink')
    broadcaster.pos = [40, 40]
    sink.pos = [60, 60]
    broadcaster.updateArea()
    sink.updateArea()
    const group = new LGraphGroup('Sampling')
    graph.add(group)
    group._bounding.set([0, 0, 400, 400])

    let selfGroups: readonly { title: string }[] = []
    let candidateGroups: readonly { title: string }[] = []
    supply(
      new Map<string, Supplier>([
        [
          'Broadcaster',
          (view) => {
            selfGroups = view.self.groups
            candidateGroups = view.unconnectedInputs()[0]?.nodeGroups ?? []
            return []
          }
        ]
      ])
    )

    expect(selfGroups.map((g) => g.title)).toEqual(['Sampling'])
    expect(candidateGroups.map((g) => g.title)).toEqual(['Sampling'])
  })

  it('lets a supplier read the type plugged into its own input', () => {
    // The whole broadcast pattern is "send whatever is plugged into me to
    // every unconnected input of the same type". Without this a supplier is
    // type-blind and would feed a CLIP into a MODEL slot in silence.
    const source = spawn('Sink')
    source.addOutput('model', 'MODEL')
    const broadcaster = spawn('Broadcaster')
    // The real broadcast node takes a value in and rebroadcasts it.
    broadcaster.addInput('anything', '*')
    source.connect(0, broadcaster, 0)

    let own: readonly {
      name: string
      connected: boolean
      connectedType: string | undefined
      sourceNodeId: string | undefined
    }[] = []
    supply(
      new Map<string, Supplier>([
        [
          'Broadcaster',
          (view) => {
            own = view.self.inputs
            return []
          }
        ]
      ])
    )

    expect(own[0]).toMatchObject({
      connected: true,
      sourceNodeId: String(source.id)
    })
    expect(own[0].connectedType).toBeDefined()
  })

  it('reads the type arriving from a subgraph input panel', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'model', type: 'MODEL' }]
    })
    const broadcaster = LiteGraph.createNode('Broadcaster')!
    const input = broadcaster.addInput('anything', '*')
    subgraph.add(broadcaster)
    subgraph.inputNode.slots[0].connect(input, broadcaster)
    let connectedType: string | undefined

    resolveSuppliedInputs(
      subgraph,
      new Map<string, Supplier>([
        [
          'Broadcaster',
          (view) => {
            connectedType = view.self.inputs[0]?.connectedType
            return []
          }
        ]
      ]),
      new Map()
    )

    expect(connectedType).toBe('MODEL')
  })

  it('reports an unconnected input of its own as unconnected', () => {
    spawn('Broadcaster').addInput('anything', '*')
    let own: readonly { connected: boolean; connectedType?: string }[] = []
    supply(
      new Map<string, Supplier>([
        [
          'Broadcaster',
          (view) => {
            own = view.self.inputs
            return []
          }
        ]
      ])
    )

    expect(own[0]?.connected).toBe(false)
    expect(own[0]?.connectedType).toBeUndefined()
  })

  it('lets a supplier inspect the outputs it broadcasts', () => {
    const broadcaster = spawn('Broadcaster')
    broadcaster.outputs[0].label = 'Model output'
    broadcaster.setOutputDataType(0, 'MODEL')
    let own: unknown

    supply(
      new Map<string, Supplier>([
        [
          'Broadcaster',
          (view) => {
            own = Reflect.get(view.self, 'outputs')
            return []
          }
        ]
      ])
    )

    expect(own).toEqual([
      { index: 0, name: 'out', label: 'Model output', type: 'MODEL' }
    ])
  })

  it('can supply a literal instead of a connection', () => {
    const sink = spawn('Sink')
    spawn('Broadcaster')

    const supplied = supply(
      new Map<string, Supplier>([
        [
          'Broadcaster',
          (view) =>
            view
              .unconnectedInputs()
              .filter((i) => i.type === 'MODEL')
              .map((i) => ({
                to: { nodeId: i.nodeId, input: i.input },
                from: { literal: 'baked' }
              }))
        ]
      ])
    )

    expect(supplied.get(`${sink.id}:0`)).toEqual({
      kind: 'literal',
      value: 'baked'
    })
  })

  it('follows what the demand-side pass already resolved for its output', () => {
    // The broadcaster may itself be fed through a reroute chain.
    const source = spawn('Broadcaster')
    const sink = spawn('Sink')
    const already = new Map([
      [`${source.id}:0`, { kind: 'output' as const, nodeId: '99', output: 3 }]
    ])

    const supplied = resolveSuppliedInputs(
      graph,
      new Map([['Broadcaster', broadcastModel]]),
      already
    )

    expect(supplied.get(`${sink.id}:0`)).toEqual({
      kind: 'output',
      nodeId: '99',
      output: 3
    })
  })

  it('forwards whatever feeds its own input, for a node with no outputs', () => {
    // The shape the broadcast packs actually have: inputs, no outputs. They
    // rebroadcast their upstream, so `{output: 0}` would name a slot the
    // backend never declared and force it to execute a node producing nothing.
    class Relay extends LGraphNode {
      constructor() {
        super('Relay')
        this.addInput('in', '*')
      }
    }
    LiteGraph.registerNodeType('Relay', Relay)
    cleanups.push(() => LiteGraph.unregisterNodeType('Relay'))

    const upstream = spawn('Broadcaster')
    const relay = spawn('Relay')
    const sink = spawn('Sink')
    upstream.connect(0, relay, 0)

    const supplied = resolveSuppliedInputs(
      graph,
      new Map<string, Supplier>([
        [
          'Relay',
          (view) =>
            view
              .unconnectedInputs()
              .filter((i) => i.type === 'MODEL')
              .map((i) => ({
                to: { nodeId: i.nodeId, input: i.input },
                from: { forwardInput: 0 }
              }))
        ]
      ]),
      new Map()
    )

    expect(supplied.get(`${sink.id}:0`)).toEqual({
      kind: 'output',
      nodeId: String(upstream.id),
      output: 0
    })
  })

  it('omits when nothing feeds the input it would forward', () => {
    class Relay2 extends LGraphNode {
      constructor() {
        super('Relay2')
        this.addInput('in', '*')
      }
    }
    LiteGraph.registerNodeType('Relay2', Relay2)
    cleanups.push(() => LiteGraph.unregisterNodeType('Relay2'))
    spawn('Relay2')
    const sink = spawn('Sink')

    const supplied = resolveSuppliedInputs(
      graph,
      new Map<string, Supplier>([
        [
          'Relay2',
          (view) =>
            view
              .unconnectedInputs()
              .filter((i) => i.type === 'MODEL')
              .map((i) => ({
                to: { nodeId: i.nodeId, input: i.input },
                from: { forwardInput: 0 }
              }))
        ]
      ]),
      new Map()
    )

    expect(supplied.get(`${sink.id}:0`)).toMatchObject({ kind: 'omitted' })
  })

  it('exposes what a broadcaster needs to match on', () => {
    // Matching by type alone would feed every unconnected input of that type.
    // The packs gate on their own per-node opt-in, kept in properties.
    const sink = spawn('Sink')
    sink.title = 'My Sampler'
    sink.properties.ue_connectable = true

    let seen: readonly UnconnectedInput[] = []
    spawn('Broadcaster')
    resolveSuppliedInputs(
      graph,
      new Map<string, Supplier>([
        [
          'Broadcaster',
          (view) => {
            seen = view.unconnectedInputs()
            return []
          }
        ]
      ]),
      new Map()
    )

    const model = seen.find((i) => i.nodeId === String(sink.id))
    expect(model?.nodeTitle).toBe('My Sampler')
    expect(model?.nodeProperties.ue_connectable).toBe(true)
    expect(model?.label).toBe('model')
    expect(model?.isWidgetInput).toBe(false)
  })

  it('does nothing at all when no pack registered a supplier', () => {
    spawn('Broadcaster')
    spawn('Sink')
    expect(supply(new Map()).size).toBe(0)
  })
})

describe('a supplier reading its own configuration', () => {
  class Everywhere extends LGraphNode {
    constructor() {
      super('Anything Everywhere')
    }
  }

  beforeEach(() => {
    LiteGraph.registerNodeType('Anything Everywhere', Everywhere)
  })

  /** Runs a supplier over a graph holding one configured broadcaster. */
  function supplierSees(
    read: (view: SupplyView) => void,
    properties: Record<string, unknown>
  ) {
    const graph = new LGraph()
    const node = LiteGraph.createNode('Anything Everywhere')!
    Object.assign(node.properties, properties)
    graph.add(node)
    resolveSuppliedInputs(
      graph,
      new Map([
        [
          'Anything Everywhere',
          (view: SupplyView) => {
            read(view)
            return []
          }
        ]
      ]),
      new Map()
    )
  }

  it('sees its own properties, not just other nodes', () => {
    // A broadcaster keeps its per-node opt-in on itself. Candidate inputs
    // already carry nodeProperties, so without this a supplier could read
    // every node's configuration except its own.
    let seen: unknown
    supplierSees(
      (view) => {
        seen = view.self.properties['ue_properties']
      },
      { ue_properties: { group_restricted: true } }
    )

    expect(seen).toEqual({ group_restricted: true })
  })

  it('hands over a frozen copy, so a supplier cannot rewrite the node', () => {
    let frozen: boolean | undefined
    supplierSees(
      (view) => {
        frozen = Object.isFrozen(view.self.properties)
      },
      { ue_properties: { on: true } }
    )

    expect(frozen).toBe(true)
  })
})
