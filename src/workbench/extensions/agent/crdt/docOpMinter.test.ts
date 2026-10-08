import { readFileSync } from 'node:fs'
import { applyOps, mint, project } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { isRootGraphDocBound } from '@/lib/litegraph/src/docBoundGraphs'
import {
  emitGraphIntent,
  withGraphIntentSource
} from '@/lib/litegraph/src/graphIntents'
import {
  LGraph,
  LGraphEventMode,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reportError } from '@/platform/telemetry/reportError'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toRootGraphId } from '@/types/graphScopeId'
import type { RootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createUuidv4 } from '@/utils/uuid'

import { attachDocOpMinter, wireNodeSnapshot } from './docOpMinter'
import type { DocOpMinter, DocOpMinterDeps } from './docOpMinter'
import type { GraphOperation } from './graphOperations'
import { readDocPromotedWidgets } from './agentSubgraphDefinitions'
import { readDocSlotNames } from './liveGraphApplier'
import { mintWireOps } from './opEnvelope'

vi.mock(import('@/platform/telemetry/reportError'))

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

const IMAGES_GROUP = 'model.images'

/** Mirrors the GPT Image node's `model.images.image_N` autogrow group. */
class TestAutogrowSink extends LGraphNode {
  constructor() {
    super('Test Autogrow Sink')
    useLitegraphService().addNodeInput(
      this,
      transformInputSpecV1ToV2(
        [
          'COMFY_AUTOGROW_V3',
          {
            template: {
              input: { required: { image: ['IMAGE', {}] } },
              names: ['image_1', 'image_2', 'image_3'],
              min: 0
            }
          }
        ],
        { name: IMAGES_GROUP, isOptional: false }
      )
    )
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

/** A widget-backed input, so a subgraph can promote it onto its instance. */
class TestPrompt extends LGraphNode {
  constructor() {
    super('Test Prompt')
    const input = this.addInput('text', 'STRING')
    input.widget = { name: 'text' }
    this.addWidget('text', 'text', 'an interior default', () => {})
    this.serialize_widgets = true
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestSource: { widget_order: ['steps'] },
    TestSink: { widget_order: [] },
    TestAutogrowSink: { widget_order: [] },
    TestPrompt: { widget_order: ['text'] }
  }
}

/** The bound document's view of `graph`, as the host holds it. */
function mintDocFrom(graph: LGraph) {
  const serialized = graph.serialize() as unknown as WorkflowJSON
  return mint(serialized, CATALOG)
}

const zDocInputs = z.array(
  z.object({ name: z.string(), link: z.number().nullable() })
)

function applyOutcomes(doc: ReturnType<typeof mint>, ops: GraphOperation[]) {
  return applyOps(
    doc,
    mintWireOps(ops, { actor: 'human:user:tab', baseVersion: 1 }),
    CATALOG
  ).outcomes
}

function applyMinted(doc: ReturnType<typeof mint>, ops: GraphOperation[]) {
  return applyOutcomes(doc, ops).map((outcome) => outcome.outcome)
}

function docInputs(doc: ReturnType<typeof mint>, nodeId: unknown) {
  const node = project(doc, CATALOG).nodes.find(
    (candidate) => String(candidate.id) === String(nodeId)
  )
  return node ? zDocInputs.parse(node.inputs) : null
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
  LiteGraph.registerNodeType('TestAutogrowSink', TestAutogrowSink)
  LiteGraph.registerNodeType('TestNote', TestNote)
  LiteGraph.registerNodeType('TestPrompt', TestPrompt)
})

describe('attachDocOpMinter', () => {
  let graph: LGraph
  let rootGraphId: RootGraphId
  let minted: GraphOperation[]
  let minter: DocOpMinter
  let enabled: boolean
  let bound: boolean
  let docInputNames: DocOpMinterDeps['docInputNames']
  let docPromotedWidgets: DocOpMinterDeps['docPromotedWidgets']
  let docPopulated: boolean
  let refused: Parameters<
    NonNullable<DocOpMinterDeps['onWidgetWriteRefused']>
  >[0][]

  beforeEach(() => {
    graph = new LGraph()
    rootGraphId = toRootGraphId(graph.id)
    minted = []
    enabled = true
    bound = true
    docInputNames = () => null
    docPromotedWidgets = () => null
    docPopulated = true
    refused = []
    minter = attachDocOpMinter({
      isEnabled: () => enabled,
      isDocBound: () => bound,
      enqueue: (operations) => minted.push(...operations),
      getGraph: () => graph,
      boundRootGraphId: () => rootGraphId,
      docInputNames: (nodeId) => docInputNames(nodeId),
      docPromotedWidgets: (nodeId) => docPromotedWidgets(nodeId),
      isDocPopulated: () => docPopulated,
      onWidgetWriteRefused: (write) => refused.push(write)
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
        command: 'set_node_field title',
        act: (g: LGraph) => {
          const { source } = seedGraph(g)
          source.title = 'Renamed'
          return {
            op: 'set_node_field',
            node_id: source.id,
            field: 'title',
            value: 'Renamed'
          }
        }
      },
      {
        command: 'set_node_field mode',
        act: (g: LGraph) => {
          const { source } = seedGraph(g)
          source.mode = LGraphEventMode.BYPASS
          return {
            op: 'set_node_field',
            node_id: source.id,
            field: 'mode',
            value: LGraphEventMode.BYPASS
          }
        }
      },
      {
        command: 'set_node_field flags.collapsed',
        act: (g: LGraph) => {
          const { source } = seedGraph(g)
          source.collapse()
          return {
            op: 'set_node_field',
            node_id: source.id,
            field: 'flags.collapsed',
            value: true
          }
        }
      },
      {
        command: 'set_node_field flags.pinned',
        act: (g: LGraph) => {
          const { source } = seedGraph(g)
          withGraphIntentSource('load', () => source.pin(true))
          source.unpin()
          return {
            op: 'set_node_field',
            node_id: source.id,
            field: 'flags.pinned',
            value: null
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
      source.title = 'Renamed'
      source.mode = LGraphEventMode.NEVER
      source.collapse()
      source.pin()
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

  it('snapshots a pasted node after its same-tick configure, folding the widget and field writes into add_node', async () => {
    const node = new TestSource()
    graph.add(node)
    node.configure(fromPartial({ widgets_values: [7], title: 'Pasted' }))
    node.widgets![0].value = 9
    node.mode = LGraphEventMode.BYPASS
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({
        op: 'add_node',
        node: expect.objectContaining({
          widgets_values: { steps: 9 },
          title: 'Pasted',
          mode: LGraphEventMode.BYPASS
        })
      })
    ])
  })

  it('applies a minted field write to the document without touching the widget register', () => {
    const { source } = seedGraph(graph)
    const doc = mintDocFrom(graph)
    const outcomes = applyMinted(doc, [
      {
        op: 'set_node_field',
        node_id: source.id,
        field: 'title',
        value: 'Renamed'
      },
      {
        op: 'set_node_field',
        node_id: source.id,
        field: 'flags.collapsed',
        value: true
      }
    ])

    expect(outcomes).toEqual(['applied', 'applied'])
    const projected = project(doc, CATALOG).nodes.find(
      (node) => String(node.id) === String(source.id)
    )
    expect(projected).toMatchObject({
      title: 'Renamed',
      flags: { collapsed: true },
      widgets_values: [20, 'button-slot']
    })
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
      boundRootGraphId: () => rootGraphId,
      docInputNames: () => null,
      docPromotedWidgets: () => null,
      isDocPopulated: () => true
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

  describe("link ops address the document's own input order", () => {
    /** A sink whose live input order (`mask`, `image`) is the reverse of the document's. */
    function seedReorderedSink() {
      const source = new TestSource()
      const sink = new LGraphNode('Reordered Sink')
      sink.addInput('mask', 'MASK')
      sink.addInput('image', 'IMAGE')
      withGraphIntentSource('load', () => {
        graph.add(source)
        graph.add(sink)
        source.connect(0, sink, 1)
      })
      return { source, sink }
    }

    it.for([
      {
        action: 'connect',
        act: (source: LGraphNode, sink: LGraphNode) => {
          sink.disconnectInput(1)
          source.connect(0, sink, 1)
        }
      },
      {
        action: 'disconnect',
        act: (_source: LGraphNode, sink: LGraphNode) => {
          sink.disconnectInput(1)
        }
      }
    ])(
      "$action mints the doc index of the live slot's name, not its live index",
      async ({ action, act }) => {
        const { source, sink } = seedReorderedSink()
        docInputNames = (nodeId) =>
          nodeId === sink.id ? ['image', 'mask'] : null

        act(source, sink)
        await afterFlush()

        expect(minted.at(-1)).toMatchObject({
          op: action,
          to_node: sink.id,
          to_slot: 0
        })
      }
    )

    it('falls back to the live index while the document has no such node yet', async () => {
      const { source, sink } = seedReorderedSink()
      docInputNames = () => null

      sink.disconnectInput(1)
      source.connect(0, sink, 1)
      await afterFlush()

      expect(minted).toEqual([
        expect.objectContaining({ op: 'disconnect', to_slot: 1 }),
        expect.objectContaining({ op: 'connect', to_slot: 1 })
      ])
    })

    it('mints nothing for a link on a slot the document lacks, reporting once', async () => {
      const { source, sink } = seedReorderedSink()
      docInputNames = (nodeId) => (nodeId === sink.id ? ['mask'] : null)

      source.connect(0, sink, 1)
      await afterFlush()

      expect(minted).toEqual([])
      expect(
        vi.mocked(reportError).mock.calls.map(([, meta]) => meta.errorType)
      ).toEqual(['agent_crdt_link_slot_not_in_doc'])
    })

    it('grows an autogrow slot the document lacks instead of naming a live index, and the applier appends it', async () => {
      const sources = [new TestSource(), new TestSource(), new TestSource()]
      const sink = new TestAutogrowSink()
      withGraphIntentSource('load', () => {
        for (const source of sources) graph.add(source)
        graph.add(sink)
        sources[0].connect(0, sink, 0)
      })
      const doc = mintDocFrom(graph)
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      expect(docInputs(doc, sink.id)).toEqual([
        { name: `${IMAGES_GROUP}.image_1`, link: sink.inputs[0].link },
        { name: `${IMAGES_GROUP}.image_2`, link: null }
      ])

      sources[1].connect(0, sink, 1)
      await afterFlush()
      expect(minted).toEqual([
        expect.objectContaining({ op: 'connect', to_slot: 1 })
      ])
      expect(applyMinted(doc, minted)).toEqual(['applied'])
      minted.length = 0

      expect(sink.inputs.map(({ name }) => name)).toEqual([
        `${IMAGES_GROUP}.image_1`,
        `${IMAGES_GROUP}.image_2`,
        `${IMAGES_GROUP}.image_3`
      ])
      sources[2].connect(0, sink, 2)
      await afterFlush()

      const handWired = sink.inputs[2].link
      expect(minted).toEqual([
        {
          op: 'connect',
          link_id: handWired,
          from_node: sources[2].id,
          from_slot: 0,
          to_node: sink.id,
          to_slot: null,
          link_type: 'IMAGE',
          grow: { name: `${IMAGES_GROUP}.image_3`, type: 'IMAGE' }
        }
      ])
      expect(applyMinted(doc, minted)).toEqual(['applied'])
      expect(docInputs(doc, sink.id)).toEqual([
        { name: `${IMAGES_GROUP}.image_1`, link: sink.inputs[0].link },
        { name: `${IMAGES_GROUP}.image_2`, link: sink.inputs[1].link },
        { name: `${IMAGES_GROUP}.image_3`, link: handWired }
      ])
      doc.destroy()
    })
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

  function seedPromotedHost(hostWidgetValues?: unknown[]) {
    const subgraph = createTestSubgraph({
      rootGraph: graph,
      inputs: [
        { name: 'prefix', type: 'STRING' },
        { name: 'text', type: 'STRING' }
      ]
    })
    graph.subgraphs.set(subgraph.id, subgraph)
    const host = createTestSubgraphNode(subgraph)
    withGraphIntentSource('load', () => {
      graph.add(host)
      for (const index of [0, 1]) {
        const interior = LiteGraph.createNode('TestPrompt')
        assert.exists(interior)
        subgraph.add(interior)
        subgraph.inputNode.slots[index].connect(interior.inputs[0], interior)
      }
    })
    const serialized = graph.serialize() as unknown as WorkflowJSON
    if (hostWidgetValues) {
      const hostNode = serialized.nodes.find(
        (node) => String(node.id) === String(host.id)
      )
      assert.exists(hostNode)
      hostNode.widgets_values = hostWidgetValues
    }
    const doc = mint(serialized, CATALOG)
    docPromotedWidgets = (nodeId) => readDocPromotedWidgets(doc, String(nodeId))
    return { host, doc }
  }

  it('PM-1995: mints a promoted host write the doc host accepts', async () => {
    const { host, doc } = seedPromotedHost()
    expect(host.inputs.map((input) => input.name)).toEqual(['prefix', 'text'])

    host.widgets[1].value = 'a prompt pasted while the agent panel is open'
    await afterFlush()

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: host.id,
        widget: 'text',
        value: 'a prompt pasted while the agent panel is open',
        old: 'an interior default',
        promoted: {
          value_index: 1,
          instance_path: [String(host.id)],
          host_widgets_values: [
            'an interior default',
            'a prompt pasted while the agent panel is open'
          ]
        }
      }
    ])
    const [write] = minted
    assert(write.op === 'set_widget' && write.path == null)
    const { promoted: _dropped, ...named } = write
    expect(applyOutcomes(doc, [named])).toEqual([
      expect.objectContaining({
        outcome: 'rejected',
        reason: expect.objectContaining({ code: 'opaque_widgets' })
      })
    ])

    expect(applyMinted(doc, minted)).toEqual(['applied'])
    expect(
      project(doc, CATALOG).nodes.find(
        (node) => String(node.id) === String(host.id)
      )?.widgets_values
    ).toEqual([
      'an interior default',
      'a prompt pasted while the agent panel is open'
    ])
    doc.destroy()
  })

  it('builds the array from the host values when the document holds none', async () => {
    const { host, doc } = seedPromotedHost([])

    host.widgets[1].value = 'pasted'
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({
        promoted: {
          value_index: 1,
          instance_path: [String(host.id)],
          host_widgets_values: ['an interior default', 'pasted']
        }
      })
    ])
    expect(applyMinted(doc, minted)).toEqual(['applied'])
    expect(
      project(doc, CATALOG).nodes.find(
        (node) => String(node.id) === String(host.id)
      )?.widgets_values
    ).toEqual(['an interior default', 'pasted'])
    doc.destroy()
  })

  it.for([
    { name: 'outnumbers', stored: ['first', 'second', 'extra'] },
    { name: 'undercounts', stored: ['only'] }
  ])(
    'refuses a document whose stored array $name its matching promoted names',
    async ({ stored }) => {
      const { host, doc } = seedPromotedHost(stored)
      expect(readDocPromotedWidgets(doc, String(host.id))).toMatchObject({
        valueCount: stored.length,
        promotedNames: ['prefix', 'text']
      })

      host.widgets[1].value = 'pasted'
      await afterFlush()

      expect(minted).toEqual([])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_promoted_widget_order_drift'
        })
      )
      doc.destroy()
    }
  )

  it.for([
    {
      name: 'sizes its array for a different set of widgets',
      doc: {
        valueCount: 3,
        declaredNames: [],
        promotedNames: ['prefix', 'text', 'other']
      }
    },
    {
      name: 'declares the promoted widgets in another order',
      doc: {
        valueCount: 2,
        declaredNames: ['text', 'clip', 'prefix'],
        promotedNames: ['text', 'prefix']
      }
    },
    {
      name: 'stores another same-size promoted widget sequence',
      doc: {
        valueCount: 2,
        declaredNames: ['prefix', 'clip', 'text'],
        promotedNames: ['prefix', 'clip']
      }
    },
    {
      name: 'cannot read the promoted widget sequence',
      doc: { valueCount: 2, declaredNames: [], promotedNames: null }
    },
    {
      name: 'cannot read the stored widget array',
      doc: { valueCount: null, declaredNames: [], promotedNames: null }
    }
  ])(
    'keeps the refusal rather than misplacing a value when the document $name',
    async ({ doc: docWidgets }) => {
      const { host, doc } = seedPromotedHost()
      docPromotedWidgets = () => docWidgets

      host.widgets[1].value = 'pasted'
      await afterFlush()

      expect(minted).toEqual([])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_promoted_widget_order_drift'
        })
      )
      doc.destroy()
    }
  )

  it('drops a drifted host write without poisoning its same-tick batch', async () => {
    const source = new TestSource()
    withGraphIntentSource('load', () => graph.add(source))
    const { host, doc } = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 2,
      declaredNames: ['text', 'prefix'],
      promotedNames: ['text', 'prefix']
    })

    host.widgets[1].value = 'misplaced'
    source.widgets![0].value = 42
    await afterFlush()

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: source.id,
        widget: 'steps',
        value: 42,
        old: 20
      }
    ])
    expect(applyMinted(doc, minted)).toEqual(['applied'])
    doc.destroy()
  })

  it('drops an unpromoted host widget without poisoning its same-tick batch', async () => {
    const source = new TestSource()
    withGraphIntentSource('load', () => graph.add(source))
    const { host, doc } = seedPromotedHost()
    const extra = host.addWidget('text', 'extra', 'before', () => {})

    extra.value = 'after'
    source.widgets![0].value = 42
    await afterFlush()

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: source.id,
        widget: 'steps',
        value: 42,
        old: 20
      }
    ])
    expect(applyMinted(doc, minted)).toEqual(['applied'])
    doc.destroy()
  })

  it('seeds an unset sibling exactly as serializing the host would', async () => {
    const { host, doc } = seedPromotedHost([])
    host.widgets[0].value = undefined
    await afterFlush()
    minted.length = 0

    host.widgets[1].value = 'pasted'
    await afterFlush()

    const [write] = minted
    assert(write.op === 'set_widget' && write.path == null)
    expect(write.promoted?.host_widgets_values).toEqual(
      host.serialize().widgets_values
    )

    // Over the wire, where an unset sibling becomes the same `null` a saved
    // workflow carries for it (`widgetValueNullContract`).
    const overTheWire = JSON.parse(JSON.stringify(minted)) as GraphOperation[]
    expect(applyMinted(doc, overTheWire)).toEqual(['applied'])
    expect(
      project(doc, CATALOG).nodes.find(
        (node) => String(node.id) === String(host.id)
      )?.widgets_values
    ).toEqual([null, 'pasted'])
    doc.destroy()
  })

  it.for([
    {
      name: 'an unpromoted host widget',
      reason: 'unpromoted_widget',
      errorType: 'agent_crdt_unpromoted_host_widget',
      act: (host: ReturnType<typeof createTestSubgraphNode>) => {
        host.addWidget('text', 'extra', 'before', () => {}).value = 'after'
        return 'extra'
      }
    },
    {
      name: 'a drifted host layout',
      reason: 'layout_drift',
      errorType: 'agent_crdt_promoted_widget_order_drift',
      act: (host: ReturnType<typeof createTestSubgraphNode>) => {
        docPromotedWidgets = () => ({
          valueCount: 2,
          declaredNames: ['text', 'prefix'],
          promotedNames: ['text', 'prefix']
        })
        host.widgets[1].value = 'misplaced'
        return 'text'
      }
    },
    {
      name: 'a document that has not caught up yet',
      reason: 'doc_not_synced',
      errorType: 'agent_crdt_promoted_widget_doc_not_synced',
      act: (host: ReturnType<typeof createTestSubgraphNode>) => {
        docPromotedWidgets = () => null
        docPopulated = false
        host.widgets[1].value = 'too early'
        return 'text'
      }
    }
  ])(
    'reports and notifies a refused write to $name',
    async ({ reason, errorType, act }) => {
      const { host, doc } = seedPromotedHost()

      const name = act(host)
      await afterFlush()

      expect(minted).toEqual([])
      expect(refused).toEqual([{ nodeId: host.id, name, reason }])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ errorType })
      )
      doc.destroy()
    }
  )

  it('mints for a host it added to a document that is still empty', async () => {
    const subgraph = createTestSubgraph({
      rootGraph: graph,
      inputs: [{ name: 'text', type: 'STRING' }]
    })
    graph.subgraphs.set(subgraph.id, subgraph)
    withGraphIntentSource('load', () => {
      const interior = LiteGraph.createNode('TestPrompt')
      assert.exists(interior)
      subgraph.add(interior)
      subgraph.inputNode.slots[0].connect(interior.inputs[0], interior)
    })
    docPromotedWidgets = () => null
    docPopulated = false
    const host = createTestSubgraphNode(subgraph)

    graph.add(host)
    await afterFlush()
    host.widgets[0].value = 'typed before the echo'
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({ op: 'add_node', node_id: host.id }),
      expect.objectContaining({ op: 'set_widget', node_id: host.id })
    ])
    expect(refused).toEqual([])
  })

  it('still mints for a host the populated document does not hold yet', async () => {
    const { host, doc } = seedPromotedHost()
    docPromotedWidgets = () => null

    host.widgets[1].value = 'pasted'
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({ node_id: host.id, widget: 'text' })
    ])
    expect(refused).toEqual([])
    doc.destroy()
  })

  it('notifies a refused widget once per throttle window, not per keystroke', async () => {
    const { host, doc } = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 2,
      declaredNames: ['text', 'prefix'],
      promotedNames: ['text', 'prefix']
    })

    host.widgets[1].value = 'p'
    await afterFlush()
    host.widgets[1].value = 'pa'
    await afterFlush()

    expect(refused).toHaveLength(1)
    doc.destroy()
  })

  it('notifies the same node and widget again in another workflow', async () => {
    const first = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 2,
      declaredNames: ['text', 'prefix'],
      promotedNames: ['text', 'prefix']
    })
    first.host.widgets[1].value = 'p'
    await afterFlush()

    graph = new LGraph()
    rootGraphId = toRootGraphId(graph.id)
    const second = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 2,
      declaredNames: ['text', 'prefix'],
      promotedNames: ['text', 'prefix']
    })
    second.host.widgets[1].value = 'p'
    await afterFlush()

    expect(second.host.id).toBe(first.host.id)
    expect(refused).toHaveLength(2)
    first.doc.destroy()
    second.doc.destroy()
  })

  it('reports a drifted host once, not once per keystroke', async () => {
    const { host, doc } = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 2,
      declaredNames: ['text', 'prefix'],
      promotedNames: ['text', 'prefix']
    })

    host.widgets[1].value = 'p'
    await afterFlush()
    host.widgets[1].value = 'pa'
    await afterFlush()
    host.widgets[1].value = 'pas'
    await afterFlush()

    expect(minted).toHaveLength(0)
    expect(
      vi
        .mocked(reportError)
        .mock.calls.filter(
          ([, options]) =>
            options.errorType === 'agent_crdt_promoted_widget_order_drift'
        )
    ).toHaveLength(1)
    doc.destroy()
  })

  it('reports a drifted host once across interleaved ordinary flushes', async () => {
    const source = new TestSource()
    withGraphIntentSource('load', () => graph.add(source))
    const { host, doc } = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 2,
      declaredNames: ['text', 'prefix'],
      promotedNames: ['text', 'prefix']
    })

    host.widgets[1].value = 'p'
    await afterFlush()
    source.widgets![0].value = 41
    await afterFlush()
    host.widgets[1].value = 'pa'
    await afterFlush()
    source.widgets![0].value = 42
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({ node_id: source.id, value: 41 }),
      expect.objectContaining({ node_id: source.id, value: 42 })
    ])
    expect(
      vi
        .mocked(reportError)
        .mock.calls.filter(
          ([, options]) =>
            options.errorType === 'agent_crdt_promoted_widget_order_drift'
        )
    ).toHaveLength(1)
    doc.destroy()
  })

  it('reports the same drifted node id again in another workflow', async () => {
    const first = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 2,
      declaredNames: ['text', 'prefix'],
      promotedNames: ['text', 'prefix']
    })
    first.host.widgets[1].value = 'first workflow'
    await afterFlush()

    graph = new LGraph()
    rootGraphId = toRootGraphId(graph.id)
    const second = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 2,
      declaredNames: ['text', 'prefix'],
      promotedNames: ['text', 'prefix']
    })
    second.host.widgets[1].value = 'second workflow'
    await afterFlush()

    expect(
      vi
        .mocked(reportError)
        .mock.calls.filter(
          ([, options]) =>
            options.errorType === 'agent_crdt_promoted_widget_order_drift'
        )
    ).toHaveLength(2)
    first.doc.destroy()
    second.doc.destroy()
  })

  it('reads a shipped host whose inputs mirror under-reports its values', () => {
    const workflow = JSON.parse(
      readFileSync(
        'browser_tests/assets/subgraphs/agent-subgraph-with-two-promoted-widgets.json',
        'utf8'
      )
    ) as WorkflowJSON
    const doc = mint(workflow, CATALOG)
    const host = workflow.nodes.find((node) => String(node.id) === '11')

    // `text` holds a value and is declared by the definition, but the
    // instance's own `inputs` mirror omits it — which is why the definition,
    // not the mirror, is what places a write.
    expect(host?.widgets_values).toEqual(['a photo of a pier', 0])
    expect(readDocPromotedWidgets(doc, '11')).toEqual({
      valueCount: 2,
      declaredNames: [
        'text',
        'clip',
        'model',
        'positive',
        'negative',
        'latent_image',
        'seed'
      ],
      promotedNames: ['text', 'seed']
    })
    doc.destroy()
  })

  it('marks stored values unreadable when their definition is unavailable', () => {
    const workflow = JSON.parse(
      readFileSync(
        'browser_tests/assets/subgraphs/agent-subgraph-with-two-promoted-widgets.json',
        'utf8'
      )
    ) as WorkflowJSON
    const doc = mint(workflow, CATALOG)
    const host = workflow.nodes.find((node) => String(node.id) === '11')
    assert(typeof host?.type === 'string')
    doc.getMap('definitions').delete(host.type)

    expect(readDocPromotedWidgets(doc, '11')).toEqual({
      valueCount: 2,
      declaredNames: [],
      promotedNames: undefined
    })
    doc.destroy()
  })

  it('mints for a shipped host whose inputs mirror omits a promoted widget', async () => {
    const { host, doc } = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 2,
      declaredNames: ['prefix', 'clip', 'text'],
      promotedNames: ['prefix', 'text']
    })

    host.widgets[1].value = 'pasted'
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({
        widget: 'text',
        promoted: expect.objectContaining({ value_index: 1 })
      })
    ])
    expect(applyMinted(doc, minted)).toEqual(['applied'])
    doc.destroy()
  })

  it('mints against the live order when the document declares no definition', async () => {
    const { host, doc } = seedPromotedHost()
    docPromotedWidgets = () => ({
      valueCount: 0,
      declaredNames: [],
      promotedNames: undefined
    })

    host.widgets[1].value = 'pasted'
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({
        promoted: expect.objectContaining({ value_index: 1 })
      })
    ])
    expect(applyMinted(doc, minted)).toEqual(['applied'])
    doc.destroy()
  })

  it.for([
    {
      name: 'declares another promoted order',
      promotedNames: ['text', 'prefix']
    },
    { name: 'cannot read its declared inputs', promotedNames: null }
  ])(
    'refuses to seed an empty document array when the definition $name',
    async ({ promotedNames }) => {
      const { host, doc } = seedPromotedHost([])
      docPromotedWidgets = () => ({
        valueCount: 0,
        declaredNames: [],
        promotedNames
      })

      host.widgets[1].value = 'pasted'
      await afterFlush()

      expect(minted).toEqual([])
      doc.destroy()
    }
  )

  it('leaves a promoted widget on a nested host on the interior route', async () => {
    const outer = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(outer.id, outer)
    const inner = createTestSubgraph({
      rootGraph: graph,
      inputs: [{ name: 'text', type: 'STRING' }]
    })
    graph.subgraphs.set(inner.id, inner)
    const outerHost = createTestSubgraphNode(outer)
    const nestedHost = createTestSubgraphNode(inner, { parentGraph: outer })
    withGraphIntentSource('load', () => {
      graph.add(outerHost)
      outer.add(nestedHost)
      const interior = LiteGraph.createNode('TestPrompt')
      assert.exists(interior)
      inner.add(interior)
      inner.inputNode.slots[0].connect(interior.inputs[0], interior)
    })

    nestedHost.widgets[0].value = 'pasted'
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({
        op: 'set_widget',
        path: [String(outerHost.id), String(nestedHost.id)],
        inner_widget: 'text'
      })
    ])
    expect(minted[0]).not.toHaveProperty('promoted')
  })

  it('does not let an ephemeral widget write roll a hand edit back with it', async () => {
    const { source } = seedGraph(graph)
    // Built the way useNodeProgressText builds it: `serialize: false` and
    // absent from the pinned catalog.
    const preview = source.addWidget(
      'text',
      '$$node-text-preview',
      '',
      () => {}
    )
    preview.serialize = false
    const doc = mintDocFrom(graph)

    // One tick: execution streams progress text into the preview while the
    // user edits a real widget. The minter enqueues a tick's intents together
    // and `opSender` sends them as one batch.
    preview.value = 'streaming…'
    source.widgets![0].value = 42
    await afterFlush()

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: source.id,
        widget: 'steps',
        value: 42,
        old: 20
      }
    ])
    expect(applyMinted(doc, minted)).toEqual(['applied'])
    doc.destroy()
  })

  it.for([
    {
      name: 'serialize false (live setter)',
      setup: () => {
        const { source } = seedGraph(graph)
        source.widgets![0].serialize = false
        source.widgets![0].value = 21
      }
    },
    {
      name: 'button (live setter)',
      setup: () => {
        const { source } = seedGraph(graph)
        source.widgets![1].value = 'clicked'
      }
    },
    {
      name: 'serialize false (reachable subgraph)',
      setup: () => {
        const subgraph = createTestSubgraph({ rootGraph: graph })
        const host = createTestSubgraphNode(subgraph)
        const source = new TestSource()
        withGraphIntentSource('load', () => {
          graph.add(host)
          subgraph.add(source)
        })
        source.widgets![0].serialize = false
        emitGraphIntent({
          type: 'set_widget',
          graphId: subgraph.id,
          nodeId: source.id,
          name: 'steps',
          value: 21,
          previous: 20
        })
      }
    },
    {
      name: 'button (reachable subgraph)',
      setup: () => {
        const subgraph = createTestSubgraph({ rootGraph: graph })
        const host = createTestSubgraphNode(subgraph)
        const source = new TestSource()
        withGraphIntentSource('load', () => {
          graph.add(host)
          subgraph.add(source)
        })
        emitGraphIntent({
          type: 'set_widget',
          graphId: subgraph.id,
          nodeId: source.id,
          name: 'upload',
          value: 'clicked',
          previous: 'button-slot'
        })
      }
    },
    {
      name: 'button on a virtual node',
      setup: () => {
        const note = new TestNote()
        note.addWidget('button', 'action', 'idle', () => {})
        withGraphIntentSource('load', () => graph.add(note))
        emitGraphIntent({
          type: 'set_widget',
          graphId: graph.id,
          nodeId: note.id,
          name: 'action',
          value: 'clicked',
          previous: 'idle'
        })
      }
    }
  ])('does not mint a non-value widget write: $name', async ({ setup }) => {
    setup()
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('uses the live serialize flag for direct store-path intents', async () => {
    const { source } = seedGraph(graph)
    source.widgets![0].serialize = false

    emitGraphIntent({
      type: 'set_widget',
      graphId: graph.id,
      nodeId: source.id,
      name: 'steps',
      value: 21,
      previous: 20
    })
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('lets an explicit live serialize flag override stale store metadata', async () => {
    const { source } = seedGraph(graph)
    const widget = source.widgets![0]
    const stored = useWidgetValueStore().getWidget(
      widgetId(graph.id, source.id, widget.name)
    )
    assert.exists(stored)
    stored.serialize = false
    widget.serialize = true

    emitGraphIntent({
      type: 'set_widget',
      graphId: graph.id,
      nodeId: source.id,
      name: 'steps',
      value: 21,
      previous: 20
    })
    await afterFlush()

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: source.id,
        widget: 'steps',
        value: 21,
        old: 20
      }
    ])
  })

  it('uses the store serialize flag when a projected widget omits it', async () => {
    const { source } = seedGraph(graph)
    const widget = source.widgets![0]
    const stored = useWidgetValueStore().getWidget(
      widgetId(graph.id, source.id, widget.name)
    )
    assert.exists(stored)
    stored.serialize = false
    delete widget.serialize

    emitGraphIntent({
      type: 'set_widget',
      graphId: graph.id,
      nodeId: source.id,
      name: 'steps',
      value: 21,
      previous: 20
    })
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('uses the store serialize flag when a projected widget leaves it undefined', async () => {
    const { source } = seedGraph(graph)
    const widget = source.widgets![0]
    const stored = useWidgetValueStore().getWidget(
      widgetId(graph.id, source.id, widget.name)
    )
    assert.exists(stored)
    stored.serialize = false
    widget.serialize = undefined

    emitGraphIntent({
      type: 'set_widget',
      graphId: graph.id,
      nodeId: source.id,
      name: 'steps',
      value: 21,
      previous: 20
    })
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('uses the store type when the live widget leaves it undefined', async () => {
    const { source } = seedGraph(graph)
    const button = source.widgets![1]
    const stored = useWidgetValueStore().getWidget(
      widgetId(graph.id, source.id, button.name)
    )
    assert.exists(stored)
    expect(stored.type).toBe('button')
    // `type` is required on `IBaseWidget`, so only a non-conforming runtime
    // object reaches this state — which is the point: the guard has to answer
    // for one anyway. Assigned through `Object.assign` rather than a
    // suppression, since the subject here is runtime fallback and not a
    // compiler diagnostic.
    Object.assign(button, { type: undefined })

    emitGraphIntent({
      type: 'set_widget',
      graphId: graph.id,
      nodeId: source.id,
      name: 'upload',
      value: 'clicked',
      previous: 'button-slot'
    })
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('uses the same store fallback when filtering an add-node snapshot', () => {
    const { source } = seedGraph(graph)
    const widget = source.widgets![0]
    const stored = useWidgetValueStore().getWidget(
      widgetId(graph.id, source.id, widget.name)
    )
    assert.exists(stored)
    stored.serialize = false
    delete widget.serialize

    expect(wireNodeSnapshot(source)?.widgets_values).toEqual({})
  })

  it('omits doc-internal incarnation storage from an imported missing-node snapshot', () => {
    const node = new LGraphNode('Missing ImageScaleToTotalPixels')
    const imported: ISerialisedNode = {
      id: 41,
      type: 'ImageScaleToTotalPixels',
      pos: [10, 20],
      size: [240, 120],
      flags: {},
      order: 0,
      mode: 0
    }
    node.last_serialization = Object.assign(imported, {
      __incarnation: '0',
      extension_payload: { owner: 'custom-node' }
    })

    expect(wireNodeSnapshot(node)).toEqual(
      expect.objectContaining({
        type: 'ImageScaleToTotalPixels',
        extension_payload: { owner: 'custom-node' }
      })
    )
    expect(wireNodeSnapshot(node)).not.toHaveProperty('__incarnation')
  })

  it('does not mint an active-graph widget write without a live widget', async () => {
    emitGraphIntent({
      type: 'set_widget',
      graphId: graph.id,
      nodeId: toNodeId(999),
      name: 'missing',
      value: 21,
      previous: 20
    })
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('mints a value-widget write on a node that omits the node-level serialize flag', async () => {
    const node = new LGraphNode('No widget serialization')
    node.addWidget('number', 'steps', 20, () => {})
    withGraphIntentSource('load', () => graph.add(node))

    emitGraphIntent({
      type: 'set_widget',
      graphId: graph.id,
      nodeId: node.id,
      name: 'steps',
      value: 21,
      previous: 20
    })
    await afterFlush()

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: node.id,
        widget: 'steps',
        value: 21,
        old: 20
      }
    ])
  })

  it('judges a stale bound-graph write on its stored serialize flag', async () => {
    const previousGraph = new LGraph()
    const { source } = seedGraph(previousGraph)
    const stored = useWidgetValueStore().getWidget(
      widgetId(previousGraph.id, source.id, 'steps')
    )
    assert.exists(stored)
    stored.serialize = false
    rootGraphId = toRootGraphId(previousGraph.id)

    emitGraphIntent({
      type: 'set_widget',
      graphId: previousGraph.id,
      nodeId: source.id,
      name: 'steps',
      value: 21,
      previous: 20
    })
    await afterFlush()

    expect(minted).toEqual([])
  })

  it('mints a set_widget that names a subgraph owner with the subgraph-node path', async () => {
    const subgraph = createTestSubgraph({ rootGraph: graph })
    const host = createTestSubgraphNode(subgraph)
    const source = new TestSource()
    withGraphIntentSource('load', () => {
      graph.add(host)
      subgraph.add(source)
    })

    emitGraphIntent({
      type: 'set_widget',
      graphId: subgraph.id,
      nodeId: source.id,
      name: 'steps',
      value: 3,
      previous: 20
    })
    await afterFlush()

    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: source.id,
        widget: 'steps',
        value: 3,
        old: 20,
        path: [String(host.id), String(source.id)],
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

  it('surfaces a subgraph-interior node field write instead of minting it', async () => {
    const subgraph = createTestSubgraph({ rootGraph: graph })
    const interior = new TestSource()
    withGraphIntentSource('load', () => subgraph.add(interior))
    await afterFlush()
    minted.length = 0
    vi.mocked(reportError).mockClear()

    interior.title = 'renamed inside the subgraph'
    await afterFlush()

    expect(minted).toEqual([])
    expect(
      vi.mocked(reportError).mock.calls.map(([, meta]) => meta.errorType)
    ).toEqual(['agent_crdt_unrepresentable_subgraph_set_node_field'])
  })

  it('drops a subgraph-interior clear with neither a wire op nor telemetry', async () => {
    const subgraph = createTestSubgraph({ rootGraph: graph })
    const interior = new TestSource()
    withGraphIntentSource('load', () => subgraph.add(interior))
    await afterFlush()
    minted.length = 0
    vi.mocked(reportError).mockClear()
    expect(subgraph.nodes).toContain(interior)

    subgraph.clear()
    await afterFlush()

    expect(subgraph.nodes).toEqual([])
    expect(minted).toEqual([])
    expect(vi.mocked(reportError)).not.toHaveBeenCalled()
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
