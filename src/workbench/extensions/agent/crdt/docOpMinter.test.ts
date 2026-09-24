import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isRootGraphDocBound } from '@/lib/litegraph/src/docBoundGraphs'
import {
  emitGraphIntent,
  withGraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reportError } from '@/platform/telemetry/reportError'
import { toRootGraphId } from '@/types/graphScopeId'
import type { RootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

import { attachDocOpMinter } from './docOpMinter'
import type { DocOpMinter } from './docOpMinter'
import type { GraphOperation } from './graphOperations'
import { mintWireOps } from './opEnvelope'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

class TestSource extends LGraphNode {
  constructor() {
    super('Test Source')
    this.addWidget('number', 'steps', 20, () => {})
    this.addWidget('button', 'upload', 'button-slot', () => {})
    this.addOutput('image', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestSink extends LGraphNode {
  constructor() {
    super('Test Sink')
    this.addInput('image', 'IMAGE')
  }
}

class TestNote extends LGraphNode {
  override isVirtualNode = true
  constructor() {
    super('Test Note')
    this.addWidget('text', 'text', 'a note', () => {})
    this.serialize_widgets = true
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestSource: { widget_order: ['steps'] },
    TestSink: { widget_order: [] }
  }
}

function afterFlush(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

function seedGraph(graph: LGraph) {
  const source = new TestSource()
  const sink = new TestSink()
  withGraphIntentSource('load', () => {
    graph.add(source)
    graph.add(sink)
    source.connect(0, sink, 0)
  })
  const link = graph.getLink(sink.inputs[0].link)
  if (!link) throw new Error('seed link missing')
  return { source, sink, link }
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestSink', TestSink)
  LiteGraph.registerNodeType('TestNote', TestNote)
})

describe('attachDocOpMinter', () => {
  let graph: LGraph
  let rootGraphId: RootGraphId
  let minted: GraphOperation[]
  let minter: DocOpMinter
  let enabled: boolean
  let bound: boolean

  beforeEach(() => {
    vi.mocked(reportError).mockClear()
    graph = new LGraph()
    rootGraphId = toRootGraphId(graph.id)
    minted = []
    enabled = true
    bound = true
    minter = attachDocOpMinter({
      isEnabled: () => enabled,
      isDocBound: () => bound,
      enqueue: (operations) => minted.push(...operations),
      getGraph: () => graph,
      boundRootGraphId: () => rootGraphId
    })
  })

  afterEach(() => minter.detach())

  describe('mints one op per graph command', () => {
    it.for([
      {
        command: 'add_node',
        act: (g: LGraph) => {
          const node = new TestSource()
          node.pos = [10, 20]
          g.add(node)
          return {
            op: 'add_node',
            node_id: node.id,
            class_type: 'TestSource',
            pos: [10, 20],
            node: expect.objectContaining({
              type: 'TestSource',
              widgets_values: { steps: 20 }
            })
          }
        }
      },
      {
        command: 'connect',
        act: (g: LGraph) => {
          const { source } = seedGraph(g)
          const sink = new TestSink()
          withGraphIntentSource('load', () => g.add(sink))
          source.connect(0, sink, 0)
          return {
            op: 'connect',
            link_id: sink.inputs[0].link,
            from_node: source.id,
            from_slot: 0,
            to_node: sink.id,
            to_slot: 0,
            link_type: 'IMAGE'
          }
        }
      },
      {
        command: 'disconnect',
        act: (g: LGraph) => {
          const { sink, link } = seedGraph(g)
          sink.disconnectInput(0)
          return {
            op: 'disconnect',
            link_id: link.id,
            to_node: sink.id,
            to_slot: 0
          }
        }
      },
      {
        command: 'delete_node',
        act: (g: LGraph) => {
          const { sink, link } = seedGraph(g)
          g.remove(sink)
          return {
            op: 'delete_node',
            node_id: sink.id,
            removed_links: [link.id]
          }
        }
      },
      {
        command: 'set_widget',
        act: (g: LGraph) => {
          const { source } = seedGraph(g)
          source.widgets![0].value = 42
          return {
            op: 'set_widget',
            node_id: source.id,
            widget: 'steps',
            value: 42,
            old: 20
          }
        }
      },
      {
        command: 'clear',
        act: (g: LGraph) => {
          const { source, sink } = seedGraph(g)
          g.clear()
          return { op: 'clear', removed_nodes: [source.id, sink.id] }
        }
      }
    ])('$command', async ({ act }) => {
      const expected = act(graph)
      await afterFlush()

      expect(minted).toEqual([expected])
    })
  })

  it('mints nothing for the same commands issued as agent-remote writes', async () => {
    const { source, sink } = seedGraph(graph)

    withGraphIntentSource('agent-remote', () => {
      graph.add(new TestSource())
      sink.disconnectInput(0)
      source.connect(0, sink, 0)
      source.widgets![0].value = 7
      graph.remove(sink)
      graph.clear()
    })
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('mints nothing when a workflow is loaded through LGraph.configure', async () => {
    const seeded = new LGraph()
    const { source, sink } = seedGraph(seeded)
    const workflow = { ...seeded.serialize(), id: createUuidv4() }
    rootGraphId = toRootGraphId(workflow.id)

    graph.configure(workflow)
    await afterFlush()
    expect(minted).toEqual([])

    graph.clear()
    await afterFlush()
    expect(minted).toEqual([
      { op: 'clear', removed_nodes: [source.id, sink.id] }
    ])
  })

  it('mints nothing while the gate is closed, without blocking the edit', async () => {
    const { source } = seedGraph(graph)
    enabled = false
    source.widgets![0].value = 5
    enabled = true
    bound = false
    source.widgets![0].value = 6
    await afterFlush()

    expect(source.widgets![0].value).toBe(6)
    expect(minted).toEqual([])
  })

  it('snapshots a pasted node after its same-tick configure, folding the widget write into add_node', async () => {
    const node = new TestSource()
    graph.add(node)
    node.configure(fromPartial({ widgets_values: [7] }))
    node.widgets![0].value = 9
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({
        op: 'add_node',
        node: expect.objectContaining({ widgets_values: { steps: 9 } })
      })
    ])
  })

  it('mints nothing for a node added and removed in the same tick', async () => {
    const node = new TestSource()
    graph.add(node)
    graph.remove(node)
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('drops the links wired to a node added and removed in the same tick', async () => {
    const { sink, link } = seedGraph(graph)
    sink.disconnectInput(0)
    const added = new TestSource()
    graph.add(added)
    added.connect(0, sink, 0)
    sink.disconnectInput(0)
    added.connect(0, sink, 0)
    graph.remove(added)
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({ op: 'disconnect', link_id: link.id })
    ])
  })

  it('keeps command order across one tick and flushes the batch together', async () => {
    const { source, sink } = seedGraph(graph)
    const enqueue = vi.fn((operations: GraphOperation[]) =>
      minted.push(...operations)
    )
    minter.detach()
    minter = attachDocOpMinter({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue,
      getGraph: () => graph,
      boundRootGraphId: () => rootGraphId
    })

    const added = new TestSink()
    graph.add(added)
    sink.disconnectInput(0)
    source.connect(0, added, 0)
    await afterFlush()

    expect(enqueue).toHaveBeenCalledOnce()
    expect(minted.map((operation) => operation.op)).toEqual([
      'add_node',
      'disconnect',
      'connect'
    ])
  })

  it('drops the placement ghost flag from the add_node snapshot', async () => {
    const node = new TestSource()
    node.flags.ghost = true
    node.flags.collapsed = true
    graph.add(node)
    await afterFlush()

    expect(minted[0]).toMatchObject({
      node: { flags: { collapsed: true } }
    })
    expect(
      (minted[0] as { node: { flags: object } }).node.flags
    ).not.toHaveProperty('ghost')
  })

  // Note, PrimitiveNode, Get/Set nodes and blueprint hosts have no catalog
  // entry: the applier rejects a name-keyed record for them and stores a
  // positional array opaquely.
  it('keeps add_node widgets_values positional for a frontend-only node, and the applier takes it', async () => {
    const note = new TestNote()
    graph.add(note)
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({
        op: 'add_node',
        class_type: 'TestNote',
        node: expect.objectContaining({ widgets_values: ['a note'] })
      })
    ])
    const doc = mint({ nodes: [], links: [] }, CATALOG)
    const { outcomes } = applyOps(
      doc,
      mintWireOps(minted, { actor: 'human:user:tab', baseVersion: 1 }),
      CATALOG
    )
    expect(outcomes).toEqual([expect.objectContaining({ outcome: 'applied' })])
    doc.destroy()
  })

  it('mints a live subgraph-interior widget write with the subgraph-node path', async () => {
    const subgraph = createTestSubgraph({ rootGraph: graph })
    const host = createTestSubgraphNode(subgraph)
    const interior = new TestSource()
    withGraphIntentSource('load', () => {
      graph.add(host)
      subgraph.add(interior)
    })

    interior.widgets![0].value = 3
    await afterFlush()

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: interior.id,
        widget: 'steps',
        value: 3,
        old: 20,
        path: [String(host.id), String(interior.id)],
        inner_widget: 'steps'
      }
    ])
  })

  it('mints a set_widget that names a subgraph owner with the subgraph-node path', async () => {
    const subgraph = createTestSubgraph({ rootGraph: graph })
    const host = createTestSubgraphNode(subgraph)
    withGraphIntentSource('load', () => graph.add(host))

    emitGraphIntent({
      type: 'set_widget',
      graphId: subgraph.id,
      nodeId: toNodeId(2),
      name: 'steps',
      value: 3,
      previous: 20
    })
    await afterFlush()

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: toNodeId(2),
        widget: 'steps',
        value: 3,
        old: 20,
        path: [String(host.id), '2'],
        inner_widget: 'steps'
      }
    ])
  })

  it('surfaces subgraph-interior node and link commands instead of minting them', async () => {
    const subgraph = createTestSubgraph({ rootGraph: graph })
    const source = new TestSource()
    const sink = new TestSink()

    subgraph.add(source)
    subgraph.add(sink)
    source.connect(0, sink, 0)
    subgraph.remove(sink)
    await afterFlush()

    expect(minted).toEqual([])
    expect(
      vi.mocked(reportError).mock.calls.map(([, meta]) => meta.errorType)
    ).toEqual([
      'agent_crdt_unrepresentable_subgraph_node_create',
      'agent_crdt_unrepresentable_subgraph_connect',
      'agent_crdt_unrepresentable_subgraph_node_delete'
    ])
  })

  it('refuses to mint a command on a graph other than the bound root, reporting once per tick', async () => {
    const foreign = new LGraph()

    foreign.add(new TestSource())
    foreign.add(new TestSink())
    foreign.clear()
    await afterFlush()

    expect(minted).toEqual([])
    expect(
      vi.mocked(reportError).mock.calls.map(([, meta]) => meta.errorType)
    ).toEqual([
      'agent_crdt_op_for_unbound_graph',
      'agent_crdt_op_for_unbound_graph'
    ])
  })

  it('stops minting after detach', async () => {
    const { source } = seedGraph(graph)
    minter.detach()

    graph.add(new TestSource())
    source.widgets![0].value = 1
    await afterFlush()

    expect(minted).toEqual([])
  })

  describe('doc-bound root graph probe', () => {
    it('registers the probe on attach and answers only while enabled and doc-bound', () => {
      expect(isRootGraphDocBound(graph.id)).toBe(true)

      enabled = false
      expect(isRootGraphDocBound(graph.id)).toBe(false)
      enabled = true

      bound = false
      expect(isRootGraphDocBound(graph.id)).toBe(false)
      bound = true

      expect(isRootGraphDocBound(graph.id)).toBe(true)
    })

    it('unregisters the probe on detach', () => {
      expect(isRootGraphDocBound(graph.id)).toBe(true)

      minter.detach()

      expect(isRootGraphDocBound(graph.id)).toBe(false)
    })
  })
})
