/**
 * Extended link-materialization coverage for `insert_workflow`, targeting
 * the PM-1562 bug class (order-independent numeric link-id derivation) with
 * topologies `agentInsertWorkflowLinks.regression.test.ts` does not cover:
 * fan-out, several independent chains landing in one batch, links crossing a
 * freshly-inserted subgraph's boundary (both directions), a fully-interior
 * subgraph link, and node-id collisions that must not cross-wire links.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  InsertWorkflowOp,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import * as Y from 'yjs'

import {
  LGraph,
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { toNodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'

class TestSource extends LGraphNode {
  static override title = 'Test Source'
  constructor() {
    super('Test Source')
    this.addOutput('IMAGE', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestPassthrough extends LGraphNode {
  static override title = 'Test Passthrough'
  constructor() {
    super('Test Passthrough')
    this.addInput('image', 'IMAGE')
    this.addOutput('IMAGE', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestSink extends LGraphNode {
  static override title = 'Test Sink'
  constructor() {
    super('Test Sink')
    this.addInput('images', 'IMAGE')
    this.serialize_widgets = true
  }
}

/** Two image inputs feeding one output, for fan-in topologies. */
class TestCombine extends LGraphNode {
  static override title = 'Test Combine'
  constructor() {
    super('Test Combine')
    this.addInput('image_a', 'IMAGE')
    this.addInput('image_b', 'IMAGE')
    this.addOutput('IMAGE', 'IMAGE')
    this.serialize_widgets = true
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestSource: { widget_order: [] },
    TestPassthrough: { widget_order: [] },
    TestSink: { widget_order: [] },
    TestCombine: { widget_order: [] }
  }
}

let opSeq = 0
function insertOp(
  workflow: InsertWorkflowOp['workflow'],
  opId?: string
): InsertWorkflowOp {
  opSeq += 1
  return {
    op_id: (opId ?? `insert-link-topology-op-${opSeq}`).padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  }
}

function bindProjection(workflowId: string, graph: LGraph) {
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind(workflowId, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
  })

  let seq = 0
  const deliver = (update: Uint8Array, opIds: string[]): boolean => {
    follower.applyRemoteUpdate(update)
    const committed = projection.applyFrame({
      workflowId,
      seq: ++seq,
      update,
      actor: 'agent:test',
      opIds
    }).applied
    return committed
  }
  return deliver
}

function readInputOrigins(node: LGraphNode) {
  return node.inputs.map((input, index) => ({
    name: input.name,
    origin: node.getInputLink(index)?.origin_id ?? null
  }))
}

function findByType(graph: LGraph, type: string): LGraphNode {
  const node = graph._nodes.find((candidate) => candidate.type === type)
  if (!node) throw new Error(`no live node of type ${type} was materialized`)
  return node
}

function findAllByType(graph: LGraph, type: string): LGraphNode[] {
  return graph._nodes.filter((candidate) => candidate.type === type)
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestPassthrough', TestPassthrough)
  LiteGraph.registerNodeType('TestSink', TestSink)
  LiteGraph.registerNodeType('TestCombine', TestCombine)
})

describe('insert_workflow materializes varied link topologies', () => {
  it('wires a single output fanning out to two independent downstream inputs', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())

    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'TestSource',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [10, 11] }]
        },
        {
          id: 2,
          type: 'TestPassthrough',
          inputs: [{ name: 'image', type: 'IMAGE', link: 10 }]
        },
        {
          id: 3,
          type: 'TestSink',
          inputs: [{ name: 'images', type: 'IMAGE', link: 11 }]
        }
      ],
      links: [
        [10, 1, 0, 2, 0, 'IMAGE'],
        [11, 1, 0, 3, 0, 'IMAGE']
      ]
    }
    const op = insertOp(workflow)
    expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-fan-out', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [op.op_id])).toBe(true)

    const source = findByType(graph, 'TestSource')
    const passthrough = findByType(graph, 'TestPassthrough')
    const sink = findByType(graph, 'TestSink')
    expect(readInputOrigins(passthrough)).toEqual([
      { name: 'image', origin: source.id }
    ])
    expect(readInputOrigins(sink)).toEqual([
      { name: 'images', origin: source.id }
    ])
  })

  it('wires three independent chains inserted in one batch without cross-wiring', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())

    const chain = (base: number) => ({
      nodes: [
        {
          id: base,
          type: 'TestSource',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [base + 100] }]
        },
        {
          id: base + 1,
          type: 'TestSink',
          inputs: [{ name: 'images', type: 'IMAGE', link: base + 100 }]
        }
      ],
      links: [[base + 100, base, 0, base + 1, 0, 'IMAGE']]
    })
    const workflow = {
      nodes: [...chain(1).nodes, ...chain(10).nodes, ...chain(20).nodes],
      links: [...chain(1).links, ...chain(10).links, ...chain(20).links]
    }
    const op = insertOp(workflow)
    expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-parallel-chains', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [op.op_id])).toBe(true)

    const sinks = findAllByType(graph, 'TestSink')
    expect(sinks).toHaveLength(3)
    const sources = findAllByType(graph, 'TestSource')
    expect(sources).toHaveLength(3)
    // Every sink's origin must be exactly one of the three sources, and no
    // two sinks may share the same origin (which would mean a chain crossed
    // into another).
    const origins = sinks.map((sink) => readInputOrigins(sink)[0]?.origin)
    expect(new Set(origins).size).toBe(3)
    for (const origin of origins) {
      expect(sources.map((s) => s.id)).toContainEqual(origin)
    }
  })

  it('wires a link from an external node into a freshly-inserted subgraph instance promoted input', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    const blueprintGraph = new LGraph()
    const subgraph = createTestSubgraph({
      rootGraph: blueprintGraph,
      inputs: [{ name: 'images', type: 'IMAGE' }]
    })
    blueprintGraph.subgraphs.set(subgraph.id, subgraph)
    const interior = LiteGraph.createNode('TestSink')!
    interior.id = toNodeId(7)
    subgraph.add(interior)
    subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)

    const instanceHost = createTestSubgraphNode(subgraph, { id: 2 })
    blueprintGraph.add(instanceHost)
    const source = LiteGraph.createNode('TestSource')!
    source.id = toNodeId(1)
    blueprintGraph.add(source)
    source.connect(0, instanceHost, 0)

    const workflow = JSON.parse(
      JSON.stringify(blueprintGraph.serialize())
    ) as InsertWorkflowOp['workflow']

    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())
    const op = insertOp(workflow)
    expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-into-subgraph', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [op.op_id])).toBe(true)

    const liveSource = findByType(graph, 'TestSource')
    const instance = graph._nodes.find(
      (node): node is SubgraphNode => node instanceof SubgraphNode
    )
    expect(instance).toBeDefined()
    if (!instance) return
    const links = graph.serialize().links
    expect(
      links.some(
        ([, originId, , targetId, targetSlot]) =>
          originId === liveSource.id &&
          targetId === instance.id &&
          targetSlot === 0
      )
    ).toBe(true)
  })

  it('renders a fully-interior link between two nodes inside a freshly-inserted subgraph, via insert_workflow', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    // Build the blueprint from a real litegraph graph (as the paste path
    // does), so its serialized shape is exactly what insert_workflow's
    // applier remaps: a subgraph definition whose interior link has no
    // promoted host slot at all.
    const blueprintGraph = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: blueprintGraph })
    blueprintGraph.subgraphs.set(subgraph.id, subgraph)
    const source = LiteGraph.createNode('TestSource')!
    source.id = toNodeId(1)
    subgraph.add(source)
    const sink = LiteGraph.createNode('TestSink')!
    sink.id = toNodeId(2)
    subgraph.add(sink)
    source.connect(0, sink, 0)

    const host = createTestSubgraphNode(subgraph, { id: 3 })
    blueprintGraph.add(host)
    const workflow = JSON.parse(
      JSON.stringify(blueprintGraph.serialize())
    ) as InsertWorkflowOp['workflow']

    const hostDoc = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => hostDoc.destroy())
    const op = insertOp(workflow)
    expect(applyOps(hostDoc, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-interior-link', graph)
    expect(deliver(Y.encodeStateAsUpdate(hostDoc), [op.op_id])).toBe(true)

    const instance = graph._nodes.find(
      (node): node is SubgraphNode => node instanceof SubgraphNode
    )
    expect(instance).toBeDefined()
    if (!instance) return

    const interiorSource = instance.subgraph._nodes.find(
      (n) => n.type === 'TestSource'
    )
    const interiorSink = instance.subgraph._nodes.find(
      (n) => n.type === 'TestSink'
    )
    expect(interiorSource).toBeDefined()
    expect(interiorSink).toBeDefined()
    if (!interiorSource || !interiorSink) return
    expect(readInputOrigins(interiorSink)).toEqual([
      { name: 'images', origin: interiorSource.id }
    ])
  })

  it('does not cross-wire links when two inserts in one batch collide on node ids', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())

    // Both inserts number their source and sink identically (1, 2); only the
    // op_id disambiguates the derived live ids. If link resolution ever
    // collapsed ids down to their trailing numeric segment, node 1's output
    // in op A could end up wired to node 2's input in op B.
    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'TestSource',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [99] }]
        },
        {
          id: 2,
          type: 'TestSink',
          inputs: [{ name: 'images', type: 'IMAGE', link: 99 }]
        }
      ],
      links: [[99, 1, 0, 2, 0, 'IMAGE']]
    }
    const opA = insertOp(workflow, 'insert-collide-a')
    const opB = insertOp(workflow, 'insert-collide-b')
    expect(applyOps(host, [opA, opB], CATALOG).outcomes).toEqual([
      { op_id: opA.op_id, outcome: 'applied' },
      { op_id: opB.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-batch-collision', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [opA.op_id, opB.op_id])).toBe(
      true
    )

    const sources = findAllByType(graph, 'TestSource')
    const sinks = findAllByType(graph, 'TestSink')
    expect(sources).toHaveLength(2)
    expect(sinks).toHaveLength(2)

    for (const sink of sinks) {
      const origin = readInputOrigins(sink)[0]?.origin
      // Each sink's origin must be A source that exists, and every sink's
      // origin is unique to that sink's own op (no shared origin).
      expect(sources.map((s) => s.id)).toContainEqual(origin)
    }
    const origins = sinks.map((sink) => readInputOrigins(sink)[0]?.origin)
    expect(new Set(origins).size).toBe(2)
  })

  it('wires a link from a freshly-inserted subgraph instance promoted output to an external node', () => {
    const graph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))

    const blueprintGraph = new LGraph()
    const subgraph = createTestSubgraph({
      rootGraph: blueprintGraph,
      outputs: [{ name: 'IMAGE', type: 'IMAGE' }]
    })
    blueprintGraph.subgraphs.set(subgraph.id, subgraph)
    const interior = LiteGraph.createNode('TestSource')!
    interior.id = toNodeId(7)
    subgraph.add(interior)
    subgraph.outputNode.slots[0].connect(interior.outputs[0], interior)

    const instanceHost = createTestSubgraphNode(subgraph, { id: 2 })
    blueprintGraph.add(instanceHost)
    const sink = LiteGraph.createNode('TestSink')!
    sink.id = toNodeId(1)
    blueprintGraph.add(sink)
    instanceHost.connect(0, sink, 0)

    const workflow = JSON.parse(
      JSON.stringify(blueprintGraph.serialize())
    ) as InsertWorkflowOp['workflow']

    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())
    const op = insertOp(workflow)
    expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-out-of-subgraph', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [op.op_id])).toBe(true)

    const liveSink = findByType(graph, 'TestSink')
    const instance = graph._nodes.find(
      (node): node is SubgraphNode => node instanceof SubgraphNode
    )
    expect(instance).toBeDefined()
    if (!instance) return
    expect(readInputOrigins(liveSink)).toEqual([
      { name: 'images', origin: instance.id }
    ])
  })

  it('wires a fan-in link where two independent sources feed one combine node', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())

    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'TestSource',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [201] }]
        },
        {
          id: 2,
          type: 'TestSource',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [202] }]
        },
        {
          id: 3,
          type: 'TestCombine',
          inputs: [
            { name: 'image_a', type: 'IMAGE', link: 201 },
            { name: 'image_b', type: 'IMAGE', link: 202 }
          ]
        }
      ],
      links: [
        [201, 1, 0, 3, 0, 'IMAGE'],
        [202, 2, 0, 3, 1, 'IMAGE']
      ]
    }
    const op = insertOp(workflow)
    expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
      { op_id: op.op_id, outcome: 'applied' }
    ])

    const deliver = bindProjection('wf-fan-in', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [op.op_id])).toBe(true)

    const [sourceA, sourceB] = findAllByType(graph, 'TestSource')
    const combine = findByType(graph, 'TestCombine')
    expect(readInputOrigins(combine)).toEqual([
      { name: 'image_a', origin: sourceA.id },
      { name: 'image_b', origin: sourceB.id }
    ])
  })

  it('wires a link inserted incrementally into an already-materialized chain', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())

    const seedOp = insertOp(
      { nodes: [{ id: 1, type: 'TestSource' }], links: [] },
      'insert-incr-seed'
    )
    expect(applyOps(host, [seedOp], CATALOG).outcomes[0]?.outcome).toBe(
      'applied'
    )
    const deliver = bindProjection('wf-incremental-topology', graph)
    expect(deliver(Y.encodeStateAsUpdate(host), [seedOp.op_id])).toBe(true)
    expect(graph._nodes).toHaveLength(1)

    const before = Y.encodeStateVector(host)
    const secondOp = insertOp(
      {
        nodes: [
          {
            id: 2,
            type: 'TestPassthrough',
            inputs: [{ name: 'image', type: 'IMAGE', link: 300 }],
            outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [301] }]
          },
          {
            id: 3,
            type: 'TestSink',
            inputs: [{ name: 'images', type: 'IMAGE', link: 301 }]
          }
        ],
        links: [[301, 2, 0, 3, 0, 'IMAGE']]
      },
      'insert-incr-second'
    )
    expect(applyOps(host, [secondOp], CATALOG).outcomes[0]?.outcome).toBe(
      'applied'
    )
    expect(deliver(Y.encodeStateAsUpdate(host, before), [secondOp.op_id])).toBe(
      true
    )

    const passthrough = findByType(graph, 'TestPassthrough')
    const sink = findByType(graph, 'TestSink')
    expect(readInputOrigins(sink)).toEqual([
      { name: 'images', origin: passthrough.id }
    ])
  })
})
