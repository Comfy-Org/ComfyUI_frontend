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
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toRootGraphId } from '@/types/graphScopeId'
import type { RootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createUuidv4 } from '@/utils/uuid'

import {
  PROMOTED_WRITE_CATCH_UP_DEADLINE_MS,
  PROMOTED_WRITE_RETRY_MS,
  attachDocOpMinter,
  wireNodeSnapshot
} from './docOpMinter'
import type { DocOpMinter, DocOpMinterDeps } from './docOpMinter'
import type { GraphOperation } from './graphOperations'
import { readDocPromotedWidgets } from './agentSubgraphDefinitions'
import { readDocSlotNames, readDocWidgetValue } from './liveGraphApplier'
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

class TestDynamicGroup extends LGraphNode {
  constructor() {
    super('Test Dynamic Group')
    this.serialize_widgets = true
    useLitegraphService().addNodeInput(this, {
      name: 'loras',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      min: 0,
      max: 3,
      template: {
        required: {
          lora_name: ['COMBO', { options: ['A', 'B'] }],
          seed: ['INT', { default: 1, control_after_generate: true }]
        }
      }
    })
  }
}

class TestEmptyComboGroup extends LGraphNode {
  constructor() {
    super('Test Empty Combo Group')
    this.serialize_widgets = true
    useLitegraphService().addNodeInput(this, {
      name: 'loras',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      min: 0,
      max: 3,
      template: { required: { lora_name: ['COMBO', { options: [] }] } }
    })
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

function mintDocFrom(graph: LGraph, catalog: WidgetCatalog = CATALOG) {
  const serialized = graph.serialize() as unknown as WorkflowJSON
  return mint(serialized, catalog)
}

const zDocInputs = z.array(
  z.object({ name: z.string(), link: z.number().nullable() })
)

function applyOutcomes(
  doc: ReturnType<typeof mint>,
  ops: GraphOperation[],
  catalog: WidgetCatalog = CATALOG,
  baseVersion = 1
) {
  return applyOps(
    doc,
    mintWireOps(ops, { actor: 'human:user:tab', baseVersion }),
    catalog
  ).outcomes
}

function applyMinted(
  doc: ReturnType<typeof mint>,
  ops: GraphOperation[],
  catalog: WidgetCatalog = CATALOG,
  baseVersion = 1
) {
  return applyOutcomes(doc, ops, catalog, baseVersion).map(
    (outcome) => outcome.outcome
  )
}

function docInputs(
  doc: ReturnType<typeof mint>,
  nodeId: unknown,
  catalog: WidgetCatalog = CATALOG
) {
  const node = project(doc, catalog).nodes.find(
    (candidate) => String(candidate.id) === String(nodeId)
  )
  return node ? zDocInputs.parse(node.inputs) : null
}

function afterFlush(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

function dynamicComboScenario(graph: LGraph) {
  const resizeType: ComfyNodeDefV1['input'] = {
    required: {
      resize_type: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'scale by multiplier',
              inputs: { required: { multiplier: ['FLOAT', {}] } }
            },
            {
              key: 'match size',
              inputs: { required: { match: ['IMAGE,MASK', {}] } }
            }
          ]
        }
      ]
    }
  }
  useNodeDefStore().addNodeDef({
    name: 'TestResize',
    display_name: 'Test Resize',
    category: 'test',
    python_module: 'custom_nodes.test',
    description: '',
    input: resizeType,
    output: ['IMAGE'],
    output_name: ['IMAGE'],
    output_is_list: [false],
    output_node: false
  })
  const source = new TestSource()
  const resize = new LGraphNode('Test Resize', 'TestResize')
  resize.widgets = []
  useLitegraphService().addNodeInput(
    resize,
    transformInputSpecV1ToV2(resizeType.required!.resize_type, {
      name: 'resize_type'
    })
  )
  withGraphIntentSource('load', () => {
    graph.add(source)
    graph.add(resize)
  })
  const catalog: WidgetCatalog = {
    types: {
      ...CATALOG.types,
      TestResize: { widget_order: ['resize_type'] }
    }
  }
  const doc = mintDocFrom(graph, catalog)
  const selector = resize.widgets[0]
  assert(selector)
  withGraphIntentSource('load', () => {
    selector.value = 'match size'
  })
  const match = resize.findInputSlot('resize_type.match')
  expect(match).toBeGreaterThanOrEqual(0)
  return { source, resize, doc, catalog, match }
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
  LiteGraph.registerNodeType('TestDynamicGroup', TestDynamicGroup)
  LiteGraph.registerNodeType('TestEmptyComboGroup', TestEmptyComboGroup)
})

describe('attachDocOpMinter', () => {
  let graph: LGraph
  let rootGraphId: RootGraphId
  let minted: GraphOperation[]
  let minter: DocOpMinter
  let enabled: boolean
  let bound: boolean
  let docInputNames: DocOpMinterDeps['docInputNames']
  let docWidgetValue: DocOpMinterDeps['docWidgetValue']
  let docPromotedWidgets: DocOpMinterDeps['docPromotedWidgets']
  let mayWrite: boolean
  let docDefinitionIds: Set<string>
  let graphAvailable: boolean
  let unbound: boolean
  let refusals: Array<[string, string]>
  let seededPromotedDocs: Set<ReturnType<typeof mint>>
  let dynamicComboDocs: Set<ReturnType<typeof mint>>

  function registeredDynamicComboScenario() {
    const scenario = dynamicComboScenario(graph)
    dynamicComboDocs.add(scenario.doc)
    return scenario
  }

  beforeEach(() => {
    graph = new LGraph()
    rootGraphId = toRootGraphId(graph.id)
    minted = []
    enabled = true
    bound = true
    docInputNames = () => null
    docWidgetValue = () => undefined
    docPromotedWidgets = () => null
    mayWrite = true
    docDefinitionIds = new Set()
    graphAvailable = true
    unbound = false
    refusals = []
    seededPromotedDocs = new Set()
    dynamicComboDocs = new Set()
    minter = attachDocOpMinter({
      isEnabled: () => enabled,
      isDocBound: () => bound,
      enqueue: (operations) => minted.push(...operations),
      getGraph: () => (graphAvailable ? graph : null),
      boundRootGraphId: () => (unbound ? null : rootGraphId),
      docInputNames: (nodeId) => docInputNames(nodeId),
      docWidgetValue: (nodeId, widgetName) =>
        docWidgetValue(nodeId, widgetName),
      docPromotedWidgets: (nodeId) => docPromotedWidgets(nodeId),
      mayWritePromotedHost: () => mayWrite,
      docHasSubgraphDefinition: (id) => docDefinitionIds.has(id),
      onWidgetWriteRefused: (nodeId, widgetName) =>
        refusals.push([nodeId, widgetName])
    })
  })

  afterEach(() => {
    minter.detach()
    for (const doc of seededPromotedDocs) {
      if (!doc.isDestroyed) doc.destroy()
    }
    for (const doc of dynamicComboDocs) {
      if (!doc.isDestroyed) doc.destroy()
    }
  })

  it('reports mint divergence once when a node cannot be serialized', async () => {
    const node = new TestSource()
    graph.add(node)
    vi.spyOn(node, 'serialize').mockImplementation(() => {
      throw new Error('private widget content')
    })

    await afterFlush()
    await afterFlush()

    expect(minted).toEqual([])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      new Error('agent_crdt_node_snapshot_missing'),
      expect.objectContaining({
        fingerprint: ['agent_crdt_node_snapshot_missing'],
        context: expect.objectContaining({
          code: 'missing_node_snapshot',
          graphId: graph.id,
          nodeId: node.id,
          operations: ['add_node']
        })
      })
    )
  })

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
      docWidgetValue: () => undefined,
      docPromotedWidgets: () => null,
      mayWritePromotedHost: () => true,
      docHasSubgraphDefinition: () => true,
      onWidgetWriteRefused: () => {}
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

    describe('before the server echoes a grown slot', () => {
      async function mintUnechoedGrow() {
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
        sources[1].connect(0, sink, 1)
        await afterFlush()
        applyMinted(doc, minted)
        minted.length = 0
        sources[2].connect(0, sink, 2)
        await afterFlush()
        expect(minted).toEqual([
          expect.objectContaining({ op: 'connect', grow: expect.anything() })
        ])
        return { sources, sink, doc }
      }

      it('targets the pending slot with a disconnect', async () => {
        const { sink, doc } = await mintUnechoedGrow()
        const grownLink = sink.inputs[2].link

        sink.disconnectInput(2)
        await afterFlush()

        expect(minted.slice(1)).toEqual([
          {
            op: 'disconnect',
            link_id: grownLink,
            to_node: sink.id,
            to_slot: 2
          }
        ])
        expect(applyMinted(doc, minted)).toEqual(['applied', 'applied'])
        expect(docInputs(doc, sink.id)).toEqual([
          { name: `${IMAGES_GROUP}.image_1`, link: sink.inputs[0].link },
          { name: `${IMAGES_GROUP}.image_2`, link: sink.inputs[1].link },
          { name: `${IMAGES_GROUP}.image_3`, link: null }
        ])
        expect(reportError).not.toHaveBeenCalled()
        doc.destroy()
      })

      it('wires a replacing link into the pending slot instead of growing another', async () => {
        const { sources, sink, doc } = await mintUnechoedGrow()

        sources[0].connect(0, sink, 2)
        await afterFlush()

        const replacement = sink.inputs[2].link
        expect(minted.at(-1)).toEqual(
          expect.objectContaining({
            op: 'connect',
            link_id: replacement,
            to_slot: 2
          })
        )
        expect(
          minted.filter((op) => op.op === 'connect' && op.grow)
        ).toHaveLength(1)
        applyMinted(doc, minted)
        expect(docInputs(doc, sink.id)).toEqual([
          { name: `${IMAGES_GROUP}.image_1`, link: sink.inputs[0].link },
          { name: `${IMAGES_GROUP}.image_2`, link: sink.inputs[1].link },
          { name: `${IMAGES_GROUP}.image_3`, link: replacement }
        ])
        expect(reportError).not.toHaveBeenCalled()
        doc.destroy()
      })

      it('resolves by name again once the echo lands', async () => {
        const { sources, sink, doc } = await mintUnechoedGrow()
        applyMinted(doc, minted)
        minted.length = 0

        sources[0].connect(0, sink, 2)
        await afterFlush()

        expect(minted.at(-1)).toEqual(
          expect.objectContaining({ op: 'connect', to_slot: 2 })
        )
        doc.destroy()
      })

      it('drops a prediction the document has filled with another slot', async () => {
        const { sink, doc } = await mintUnechoedGrow()
        const occupied = ['image_1', 'image_2', 'other'].map(
          (name) => `${IMAGES_GROUP}.${name}`
        )
        docInputNames = (nodeId) => (nodeId === sink.id ? occupied : null)

        sink.disconnectInput(2)
        await afterFlush()

        expect(minted).toHaveLength(1)
        expect(
          vi.mocked(reportError).mock.calls.map(([, meta]) => meta.errorType)
        ).toEqual(['agent_crdt_link_slot_not_in_doc'])
        doc.destroy()
      })

      it('grows again once a grow is cancelled with its unsent source', async () => {
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
        sources[1].connect(0, sink, 1)
        await afterFlush()
        applyMinted(doc, minted)
        minted.length = 0
        const unsent = new TestSource()
        graph.add(unsent)
        unsent.connect(0, sink, 2)
        graph.remove(unsent)
        await afterFlush()
        expect(minted).toEqual([])

        sources[2].connect(0, sink, 2)
        await afterFlush()

        expect(minted).toEqual([
          expect.objectContaining({
            op: 'connect',
            link_id: sink.inputs[2].link,
            to_slot: null,
            grow: expect.objectContaining({ name: sink.inputs[2].name })
          })
        ])
        doc.destroy()
      })

      it('retargets a queued disconnect when an earlier grow is cancelled', async () => {
        const sources = [new TestSource(), new TestSource()]
        const sink = new TestAutogrowSink()
        withGraphIntentSource('load', () => {
          graph.add(sources[0])
          graph.add(sources[1])
          graph.add(sink)
        })
        const doc = mintDocFrom(graph)
        docInputNames = (nodeId) =>
          readDocSlotNames(doc, String(nodeId), 'inputs')
        sources[0].connect(0, sink, 0)
        await afterFlush()
        applyMinted(doc, minted)
        minted.length = 0
        const unsent = new TestSource()
        graph.add(unsent)
        unsent.connect(0, sink, 1)
        sources[1].connect(0, sink, 2)
        const laterGrow = sink.inputs[2]
        const laterLink = laterGrow.link
        sink.disconnectInput(2)
        graph.remove(unsent)
        await afterFlush()

        expect(minted).toEqual([
          expect.objectContaining({
            op: 'connect',
            link_id: laterLink,
            grow: expect.objectContaining({ name: laterGrow.name })
          }),
          {
            op: 'disconnect',
            link_id: laterLink,
            to_node: sink.id,
            to_slot: 1
          }
        ])
        expect(applyMinted(doc, minted)).toEqual(['applied', 'applied'])
        expect(docInputs(doc, sink.id)).toEqual([
          { name: `${IMAGES_GROUP}.image_1`, link: sink.inputs[0].link },
          { name: laterGrow.name, link: null }
        ])
        expect(reportError).not.toHaveBeenCalled()
        doc.destroy()
      })

      it('hands a cancelled grow to the link that replaced it', async () => {
        const source = new TestSource()
        const replacement = new TestSource()
        const sink = new TestAutogrowSink()
        withGraphIntentSource('load', () => {
          graph.add(source)
          graph.add(replacement)
          graph.add(sink)
        })
        const doc = mintDocFrom(graph)
        docInputNames = (nodeId) =>
          readDocSlotNames(doc, String(nodeId), 'inputs')
        source.connect(0, sink, 0)
        await afterFlush()
        applyMinted(doc, minted)
        minted.length = 0
        const unsent = new TestSource()
        graph.add(unsent)
        unsent.connect(0, sink, 1)
        replacement.connect(0, sink, 1)
        const grown = sink.inputs[1]
        graph.remove(unsent)
        await afterFlush()

        expect(minted).toEqual([
          expect.objectContaining({
            op: 'connect',
            link_id: grown.link,
            to_slot: null,
            grow: expect.objectContaining({ name: grown.name })
          })
        ])
        expect(applyMinted(doc, minted)).toEqual(['applied'])
        expect(docInputs(doc, sink.id)).toEqual([
          { name: `${IMAGES_GROUP}.image_1`, link: sink.inputs[0].link },
          { name: grown.name, link: grown.link }
        ])
        expect(reportError).not.toHaveBeenCalled()
        doc.destroy()
      })

      describe('with two grows on one node awaiting their echo', () => {
        async function mintTwoUnechoedGrows() {
          const sources = [new TestSource(), new TestSource(), new TestSource()]
          const sink = new TestAutogrowSink()
          withGraphIntentSource('load', () => {
            for (const source of sources) graph.add(source)
            graph.add(sink)
          })
          const doc = mintDocFrom(graph)
          docInputNames = (nodeId) =>
            readDocSlotNames(doc, String(nodeId), 'inputs')
          sources.forEach((source, slot) => source.connect(0, sink, slot))
          await afterFlush()
          expect(
            minted.filter((op) => op.op === 'connect' && op.grow)
          ).toHaveLength(2)
          minted.length = 0
          return { sink, doc }
        }

        it('targets the later grow at the slot after the earlier one', async () => {
          const { sink, doc } = await mintTwoUnechoedGrows()
          const grownLink = sink.inputs[2].link

          sink.disconnectInput(2)
          await afterFlush()

          expect(minted).toEqual([
            {
              op: 'disconnect',
              link_id: grownLink,
              to_node: sink.id,
              to_slot: 2
            }
          ])
          doc.destroy()
        })

        it('drops the predictions once another actor appends a slot first', async () => {
          const { sink, doc } = await mintTwoUnechoedGrows()
          const foreign = ['image_1', 'other'].map(
            (name) => `${IMAGES_GROUP}.${name}`
          )
          docInputNames = (nodeId) => (nodeId === sink.id ? foreign : null)

          sink.disconnectInput(2)
          await afterFlush()

          expect(minted).toEqual([])
          expect(
            vi.mocked(reportError).mock.calls.map(([, meta]) => meta.errorType)
          ).toEqual(['agent_crdt_link_slot_not_in_doc'])
          doc.destroy()
        })
      })
    })

    it('refuses a dynamic-combo child when the document has another selection', async () => {
      const { source, resize, doc, match } = registeredDynamicComboScenario()
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)

      source.connect(0, resize, match)
      await afterFlush()

      expect(minted).toEqual([])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_link_slot_not_in_doc'
        })
      )
    })

    it('grows a dynamic-combo child while its local selection is still in flight', async () => {
      const { source, resize, doc } = registeredDynamicComboScenario()
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)
      const selector = resize.widgets?.[0]
      assert(selector)
      withGraphIntentSource('load', () => {
        selector.value = 'scale by multiplier'
      })

      selector.value = 'match size'
      await afterFlush()
      expect(minted).toEqual([
        expect.objectContaining({
          op: 'set_widget',
          node_id: resize.id,
          widget: 'resize_type',
          value: 'match size'
        })
      ])
      minted.length = 0

      const match = resize.findInputSlot('resize_type.match')
      expect(match).toBeGreaterThanOrEqual(0)
      source.connect(0, resize, match)
      await afterFlush()

      expect(minted).toEqual([
        expect.objectContaining({
          op: 'connect',
          to_node: resize.id,
          to_slot: null,
          grow: { name: 'resize_type.match', type: 'IMAGE,MASK' }
        })
      ])
      expect(reportError).not.toHaveBeenCalled()
    })

    it('refuses a dynamic-combo child after the document supersedes its pending selection', async () => {
      const { source, resize, doc, catalog } = registeredDynamicComboScenario()
      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'match size'
            }
          ],
          catalog
        )
      ).toEqual(['applied'])
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)
      const selector = resize.widgets?.[0]
      assert(selector)
      withGraphIntentSource('load', () => {
        selector.value = 'scale by multiplier'
      })

      selector.value = 'match size'
      await afterFlush()
      expect(minted).toEqual([
        expect.objectContaining({
          op: 'set_widget',
          node_id: resize.id,
          widget: 'resize_type',
          value: 'match size'
        })
      ])
      minted.length = 0
      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'scale by multiplier'
            }
          ],
          catalog,
          2
        )
      ).toEqual(['applied'])

      const match = resize.findInputSlot('resize_type.match')
      expect(match).toBeGreaterThanOrEqual(0)
      source.connect(0, resize, match)
      await afterFlush()

      expect(minted).toEqual([])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_link_slot_not_in_doc'
        })
      )
    })

    it('refuses a dynamic-combo child while a conflicting local selection is pending', async () => {
      const { source, resize, doc, catalog } = registeredDynamicComboScenario()
      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'match size'
            }
          ],
          catalog
        )
      ).toEqual(['applied'])
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)
      const selector = resize.widgets?.[0]
      assert(selector)

      selector.value = 'scale by multiplier'
      await afterFlush()
      expect(minted).toEqual([
        expect.objectContaining({
          op: 'set_widget',
          node_id: resize.id,
          widget: 'resize_type',
          value: 'scale by multiplier'
        })
      ])
      minted.length = 0
      withGraphIntentSource('agent-remote', () => {
        selector.value = 'match size'
      })

      const match = resize.findInputSlot('resize_type.match')
      expect(match).toBeGreaterThanOrEqual(0)
      source.connect(0, resize, match)
      await afterFlush()

      expect(minted).toEqual([])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_link_slot_not_in_doc'
        })
      )
    })

    it('grows and disconnects a selected dynamic-combo child before the grow echo lands', async () => {
      const { source, resize, doc, catalog, match } =
        registeredDynamicComboScenario()
      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'match size'
            }
          ],
          catalog
        )
      ).toEqual(['applied'])
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)

      source.connect(0, resize, match)
      await afterFlush()

      const handWired = resize.inputs[match].link
      const grow = [...minted]
      expect(grow).toEqual([
        expect.objectContaining({
          op: 'connect',
          link_id: handWired,
          to_node: resize.id,
          to_slot: null,
          grow: { name: 'resize_type.match', type: 'IMAGE,MASK' }
        })
      ])
      minted.length = 0

      resize.disconnectInput(match)
      await afterFlush()
      expect(minted).toEqual([])

      expect(applyMinted(doc, grow, catalog)).toEqual(['applied'])
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)
      await afterFlush()

      expect(minted).toEqual([
        expect.objectContaining({ op: 'disconnect', link_id: handWired })
      ])
      expect(applyMinted(doc, minted, catalog)).toEqual(['applied'])
      expect(docInputs(doc, resize.id, catalog)).toContainEqual({
        name: 'resize_type.match',
        link: null
      })
      expect(reportError).not.toHaveBeenCalled()
    })

    it('grows a dynamic-combo child after a settled local selection is overwritten', async () => {
      const { source, resize, doc, catalog, match } =
        registeredDynamicComboScenario()
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)
      const selector = resize.widgets?.[0]
      assert(selector)

      selector.value = 'scale by multiplier'
      await afterFlush()
      expect(applyMinted(doc, minted, catalog)).toEqual(['applied'])
      minted.length = 0

      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'match size'
            }
          ],
          catalog,
          2
        )
      ).toEqual(['applied'])
      withGraphIntentSource('agent-remote', () => {
        selector.value = 'match size'
      })

      source.connect(0, resize, match)
      await afterFlush()

      expect(minted).toEqual([
        expect.objectContaining({
          op: 'connect',
          to_node: resize.id,
          to_slot: null,
          grow: { name: 'resize_type.match', type: 'IMAGE,MASK' }
        })
      ])
      expect(reportError).not.toHaveBeenCalled()
    })

    it('replays a deferred dynamic-combo rewire after the grow echo lands', async () => {
      const { source, resize, doc, catalog, match } =
        registeredDynamicComboScenario()
      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'match size'
            }
          ],
          catalog
        )
      ).toEqual(['applied'])
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)

      source.connect(0, resize, match)
      await afterFlush()
      const grow = [...minted]
      expect(grow).toHaveLength(1)
      minted.length = 0

      resize.disconnectInput(match)
      source.connect(0, resize, match)
      await afterFlush()
      const rewired = resize.inputs[match].link
      expect(minted).toEqual([])

      expect(applyMinted(doc, grow, catalog)).toEqual(['applied'])
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)
      await afterFlush()
      expect(applyMinted(doc, minted, catalog)).toEqual(['applied', 'applied'])

      expect(docInputs(doc, resize.id, catalog)).toContainEqual({
        name: 'resize_type.match',
        link: rewired
      })
      expect(reportError).not.toHaveBeenCalled()
    })

    it('drops a deferred dynamic-combo disconnect when another document binds', async () => {
      const { source, resize, doc, catalog, match } =
        registeredDynamicComboScenario()
      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'match size'
            }
          ],
          catalog
        )
      ).toEqual(['applied'])
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)

      source.connect(0, resize, match)
      await afterFlush()
      const grow = [...minted]
      expect(grow).toHaveLength(1)
      minted.length = 0

      resize.disconnectInput(match)
      await afterFlush()
      expect(minted).toEqual([])

      rootGraphId = toRootGraphId(new LGraph().id)
      expect(applyMinted(doc, grow, catalog)).toEqual(['applied'])
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)
      await afterFlush()

      expect(minted).toEqual([])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_link_slot_workflow_changed'
        })
      )
    })

    it('cancels an unsent dynamic-combo grow when disconnected in the same tick', async () => {
      const { source, resize, doc, catalog, match } =
        registeredDynamicComboScenario()
      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'match size'
            }
          ],
          catalog
        )
      ).toEqual(['applied'])
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)

      source.connect(0, resize, match)
      resize.disconnectInput(match)
      await afterFlush()

      expect(minted).toEqual([])
      expect(reportError).not.toHaveBeenCalled()
    })

    it('drops a deferred dynamic-combo operation when its grow never lands', async () => {
      const { source, resize, doc, catalog, match } =
        registeredDynamicComboScenario()
      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'match size'
            }
          ],
          catalog
        )
      ).toEqual(['applied'])
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)

      source.connect(0, resize, match)
      await afterFlush()
      minted.length = 0
      resize.disconnectInput(match)
      await afterFlush()

      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_CATCH_UP_DEADLINE_MS)

      expect(minted).toEqual([])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_link_slot_not_in_doc',
          context: expect.objectContaining({
            nodeId: resize.id,
            input: 'resize_type.match',
            operations: ['disconnect']
          })
        })
      )

      source.connect(0, resize, match)
      await afterFlush()
      expect(minted).toEqual([
        expect.objectContaining({
          op: 'connect',
          to_node: resize.id,
          to_slot: null,
          grow: { name: 'resize_type.match', type: 'IMAGE,MASK' }
        })
      ])
    })

    it('drops pending dynamic-combo state when its node is removed', async () => {
      const { source, resize, doc, catalog, match } =
        registeredDynamicComboScenario()
      expect(
        applyMinted(
          doc,
          [
            {
              op: 'set_widget',
              node_id: resize.id,
              widget: 'resize_type',
              value: 'match size'
            }
          ],
          catalog
        )
      ).toEqual(['applied'])
      docInputNames = (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs')
      docWidgetValue = (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName)

      source.connect(0, resize, match)
      await afterFlush()
      minted.length = 0
      resize.disconnectInput(match)
      graph.remove(resize)
      await afterFlush()
      expect(minted).toEqual([
        expect.objectContaining({ op: 'delete_node', node_id: resize.id })
      ])
      minted.length = 0

      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_CATCH_UP_DEADLINE_MS)

      expect(minted).toEqual([])
      expect(reportError).not.toHaveBeenCalled()
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
    seededPromotedDocs.add(doc)
    docPromotedWidgets = (nodeId) => readDocPromotedWidgets(doc, String(nodeId))
    return { host, doc }
  }

  it('does not grow a promoted input the subgraph host doc lacks, reporting it instead', async () => {
    const { host, doc } = seedPromotedHost()
    expect(host.inputs[1].widget).toEqual({ name: 'text' })
    const source = new LGraphNode('Text Source')
    source.addOutput('STRING', 'STRING')
    withGraphIntentSource('load', () => graph.add(source))
    docInputNames = (nodeId) => (nodeId === host.id ? [] : null)

    source.connect(0, host, 1)
    await afterFlush()

    expect(minted).toEqual([])
    expect(
      vi.mocked(reportError).mock.calls.map(([, meta]) => meta.errorType)
    ).toEqual(['agent_crdt_link_slot_not_in_doc'])
    doc.destroy()
  })

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
      errorType: 'agent_crdt_promoted_widget_not_promoted',
      widgetName: 'extra',
      act: (host: ReturnType<typeof createTestSubgraphNode>) => {
        host.addWidget('text', 'extra', 'before', () => {}).value = 'after'
      }
    },
    {
      name: 'a drifted host layout',
      errorType: 'agent_crdt_promoted_widget_order_drift',
      widgetName: 'text',
      act: (host: ReturnType<typeof createTestSubgraphNode>) => {
        docPromotedWidgets = () => ({
          valueCount: 2,
          declaredNames: ['text', 'prefix'],
          promotedNames: ['text', 'prefix']
        })
        host.widgets[1].value = 'misplaced'
      }
    }
  ])(
    'reports and notifies a refused write to $name',
    async ({ errorType, widgetName, act }) => {
      const { host, doc } = seedPromotedHost()

      act(host)
      await afterFlush()

      expect(minted).toEqual([])
      expect(refusals).toEqual([[host.id, widgetName]])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ errorType })
      )
      doc.destroy()
    }
  )

  describe('PM-2003: a promoted write made while the document is catching up', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
    })

    it('is held without a notice and minted once the document catches up', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'randomized'
      await afterFlush()

      expect(minted).toEqual([])
      expect(refusals).toEqual([])
      expect(reportError).not.toHaveBeenCalled()

      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(minted).toEqual([
        expect.objectContaining({
          op: 'set_widget',
          node_id: host.id,
          widget: 'text',
          value: 'randomized',
          promoted: expect.objectContaining({ value_index: 1 })
        })
      ])
      expect(refusals).toEqual([])
      expect(reportError).not.toHaveBeenCalled()
      doc.destroy()
    })

    it('mints the latest value once when the same widget changes again before catch-up', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'first'
      host.widgets[1].value = 'second'
      await afterFlush()
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(minted).toHaveLength(1)
      const [write] = minted
      assert(write.op === 'set_widget')
      expect(write.value).toBe('second')
      expect(write.promoted?.host_widgets_values[1]).toBe('second')
      doc.destroy()
    })

    it('is superseded by a newer write to the same widget made after catch-up', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'held'
      await afterFlush()
      mayWrite = true
      host.widgets[1].value = 'newer'
      await afterFlush()
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(
        minted.map((op) => (op.op === 'set_widget' ? op.value : op.op))
      ).toEqual(['newer'])
      doc.destroy()
    })

    it('carries every held sibling in the host values once caught up', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[0].value = 'prefix edit'
      host.widgets[1].value = 'text edit'
      await afterFlush()
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(minted.map((op) => op.op === 'set_widget' && op.widget)).toEqual([
        'prefix',
        'text'
      ])
      const last = minted.at(-1)
      assert(last?.op === 'set_widget')
      expect(last.promoted?.host_widgets_values).toEqual([
        'prefix edit',
        'text edit'
      ])
      doc.destroy()
    })

    it('is refused with one notice when the document never catches up', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'never synced'
      await afterFlush()
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_CATCH_UP_DEADLINE_MS - 1)
      expect(refusals).toEqual([])

      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(minted).toEqual([])
      expect(refusals).toEqual([[host.id, 'text']])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_promoted_widget_doc_not_synced'
        })
      )
      doc.destroy()
    })

    it('is checked against the caught-up layout, not the one it was made against', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'misplaced'
      await afterFlush()
      docPromotedWidgets = () => ({
        valueCount: 2,
        declaredNames: ['text', 'prefix'],
        promotedNames: ['text', 'prefix']
      })
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(minted).toEqual([])
      expect(refusals).toEqual([[host.id, 'text']])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_promoted_widget_order_drift'
        })
      )
      doc.destroy()
    })

    it('is refused, not minted into another workflow, when the bound workflow changes first', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'for the old workflow'
      await afterFlush()
      rootGraphId = toRootGraphId(createUuidv4())
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(minted).toEqual([])
      expect(refusals).toEqual([[host.id, 'text']])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_promoted_widget_workflow_changed'
        })
      )
      doc.destroy()
    })

    it('still lands when the catch-up arrives after one ack-timeout retry', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'slow relay'
      await afterFlush()
      await vi.advanceTimersByTimeAsync(15_500)
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(
        minted.map((op) => (op.op === 'set_widget' ? op.value : op.op))
      ).toEqual(['slow relay'])
      expect(refusals).toEqual([])
      doc.destroy()
    })

    it('is superseded by a newer write made while the document is unbound', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'older'
      await afterFlush()
      bound = false
      host.widgets[1].value = 'newer'
      await afterFlush()
      bound = true
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(minted).toEqual([])
      expect(refusals).toEqual([])
      doc.destroy()
    })

    it('is dropped when the catch-up replaced the value on the canvas', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'human value'
      await afterFlush()
      withGraphIntentSource('agent-remote', () => {
        host.widgets[1].value = 'agent value'
      })
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(minted).toEqual([])
      expect(refusals).toEqual([])
      doc.destroy()
    })

    it('is refused when a transient document unbind outlasts the catch-up deadline', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'for a closed chat'
      await afterFlush()
      bound = false
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_CATCH_UP_DEADLINE_MS)

      expect(minted).toEqual([])
      expect(refusals).toEqual([[host.id, 'text']])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'agent_crdt_promoted_widget_doc_not_synced'
        })
      )
      expect(vi.getTimerCount()).toBe(0)
      doc.destroy()
    })

    it('keeps waiting while the graph is briefly unavailable', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'during a load'
      await afterFlush()
      graphAvailable = false
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)
      expect(refusals).toEqual([])
      graphAvailable = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(
        minted.map((op) => (op.op === 'set_widget' ? op.value : op.op))
      ).toEqual(['during a load'])
      expect(refusals).toEqual([])
      doc.destroy()
    })

    it('keeps waiting through a moment when the document is unbound', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'across a resend'
      await afterFlush()
      bound = false
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)
      bound = true
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(
        minted.map((op) => (op.op === 'set_widget' ? op.value : op.op))
      ).toEqual(['across a resend'])
      expect(refusals).toEqual([])
      doc.destroy()
    })

    it('lands when the catch-up answers the last subscribe retry', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'third attempt'
      await afterFlush()
      await vi.advanceTimersByTimeAsync(40_000)
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(
        minted.map((op) => (op.op === 'set_widget' ? op.value : op.op))
      ).toEqual(['third attempt'])
      expect(refusals).toEqual([])
      doc.destroy()
    })

    it('keeps the first deadline when a newer write replaces a held one', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'first'
      await afterFlush()
      await vi.advanceTimersByTimeAsync(
        PROMOTED_WRITE_CATCH_UP_DEADLINE_MS - 1_000
      )
      host.widgets[1].value = 'second'
      await afterFlush()
      await vi.advanceTimersByTimeAsync(1_000 + PROMOTED_WRITE_RETRY_MS)

      expect(minted).toEqual([])
      expect(refusals).toEqual([[host.id, 'text']])
      doc.destroy()
    })

    it('is refused when the graph stays unavailable past the deadline', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'graph gone'
      await afterFlush()
      graphAvailable = false
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_CATCH_UP_DEADLINE_MS)
      expect(refusals).toEqual([[host.id, 'text']])
      expect(vi.getTimerCount()).toBe(0)

      graphAvailable = true
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)
      expect(minted).toEqual([])
      doc.destroy()
    })

    it('is dropped silently at once when the chat unbinds the workflow', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'for a closed chat'
      await afterFlush()
      bound = false
      unbound = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_RETRY_MS)

      expect(vi.getTimerCount()).toBe(0)
      bound = true
      unbound = false
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_CATCH_UP_DEADLINE_MS)
      expect(minted).toEqual([])
      expect(refusals).toEqual([])
      doc.destroy()
    })

    it('is dropped silently on detach', async () => {
      const { host, doc } = seedPromotedHost()
      mayWrite = false

      host.widgets[1].value = 'held'
      await afterFlush()
      expect(vi.getTimerCount()).toBe(1)
      minter.detach()
      expect(vi.getTimerCount()).toBe(0)
      mayWrite = true
      await vi.advanceTimersByTimeAsync(PROMOTED_WRITE_CATCH_UP_DEADLINE_MS)

      expect(minted).toEqual([])
      expect(refusals).toEqual([])
      doc.destroy()
    })
  })

  it('still mints for a host the caught-up document does not hold yet', async () => {
    const { host, doc } = seedPromotedHost()
    docPromotedWidgets = () => null

    host.widgets[1].value = 'pasted'
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({ node_id: host.id, widget: 'text' })
    ])
    expect(refusals).toEqual([])
    doc.destroy()
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

  function handAddedPromotedHost() {
    const inner = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(inner.id, inner)
    const outer = createTestSubgraph({
      rootGraph: graph,
      inputs: [{ name: 'text', type: 'STRING' }]
    })
    graph.subgraphs.set(outer.id, outer)
    withGraphIntentSource('load', () => {
      outer.add(createTestSubgraphNode(inner, { parentGraph: outer }))
      outer.add(createTestSubgraphNode(inner, { parentGraph: outer }))
      const interior = LiteGraph.createNode('TestPrompt')
      assert.exists(interior)
      outer.add(interior)
      outer.inputNode.slots[0].connect(interior.inputs[0], interior)
    })
    const doc = mintDocFrom(graph)
    seededPromotedDocs.add(doc)
    docPromotedWidgets = (nodeId) => readDocPromotedWidgets(doc, String(nodeId))
    const host = createTestSubgraphNode(outer)
    graph.add(host)
    return { host, inner, outer, doc }
  }

  it('defines a hand-added host’s subgraphs the document lacks, so its promoted write places', async () => {
    const { host, inner, outer, doc } = handAddedPromotedHost()
    await afterFlush()

    expect(
      minted.map((op) => (op.op === 'define_subgraph' ? op.subgraph_id : op.op))
    ).toEqual(['add_node', inner.id, outer.id])
    expect(applyMinted(doc, minted)).toEqual(['applied', 'applied', 'applied'])
    expect(readDocPromotedWidgets(doc, String(host.id))).toMatchObject({
      promotedNames: ['text']
    })

    minted = []
    host.widgets[0].value = 'pasted'
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({
        op: 'set_widget',
        widget: 'text',
        promoted: expect.objectContaining({ value_index: 0 })
      })
    ])
    expect(refusals).toEqual([])
    expect(applyMinted(doc, minted)).toEqual(['applied'])
  })

  it('keeps the add and skips a definition that cannot serialize, with its dependents', async () => {
    const { inner } = handAddedPromotedHost()
    vi.spyOn(inner, 'asSerialisable').mockImplementation(() => {
      throw new Error('extension serializer failed')
    })
    await afterFlush()

    expect(minted.map(({ op }) => op)).toEqual(['add_node'])
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'agent_crdt_subgraph_definition_unserializable',
        context: { definitionId: inner.id }
      })
    )
  })

  it('does not redefine a subgraph the document already holds', async () => {
    const { inner, outer } = handAddedPromotedHost()
    docDefinitionIds.add(inner.id)
    await afterFlush()

    expect(
      minted.map((op) => (op.op === 'define_subgraph' ? op.subgraph_id : op.op))
    ).toEqual(['add_node', outer.id])
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

  it('reports an unresolved widget owner once per graph and node across flushes', async () => {
    const staleGraph = new LGraph()
    const otherGraph = new LGraph()
    const { source: stale } = seedGraph(staleGraph)
    const { source: other } = seedGraph(otherGraph)
    const { source: active } = seedGraph(graph)
    const sibling = new TestSource()
    withGraphIntentSource('load', () => staleGraph.add(sibling))
    expect(other.id).toBe(stale.id)

    stale.widgets![0].value = 21
    active.widgets![0].value = 31
    await afterFlush()
    stale.widgets![0].value = 22
    other.widgets![0].value = 23
    sibling.widgets![0].value = 24
    await afterFlush()

    expect(minted).toEqual([
      expect.objectContaining({ node_id: active.id, value: 31 })
    ])
    expect(
      vi.mocked(reportError).mock.calls.map(([, options]) => options)
    ).toEqual([
      expect.objectContaining({
        errorType: 'agent_crdt_widget_owner_unresolved',
        context: expect.objectContaining({
          graphId: staleGraph.id,
          nodeId: stale.id
        })
      }),
      expect.objectContaining({
        errorType: 'agent_crdt_widget_owner_unresolved',
        context: expect.objectContaining({
          graphId: otherGraph.id,
          nodeId: other.id
        })
      }),
      expect.objectContaining({
        errorType: 'agent_crdt_widget_owner_unresolved',
        context: expect.objectContaining({
          graphId: staleGraph.id,
          nodeId: sibling.id
        })
      })
    ])
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
    expect(reportError).not.toHaveBeenCalled()
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

  describe('DynamicGroup rows', () => {
    function seedGroup() {
      const node = new TestDynamicGroup()
      function widget(name: string) {
        const found = node.widgets?.find((w) => w.name === name)
        if (!found) throw new Error(`Missing widget ${name}`)
        return found
      }
      withGraphIntentSource('load', () => {
        graph.add(node)
        widget('loras').value = 2
        widget('loras.1.lora_name').value = 'B'
        widget('loras.1.seed').value = 5
        widget('loras.1.seed.0').value = 'fixed'
      })
      return { node, widget }
    }

    it('mints the default of every field of a row added after a removal', async () => {
      const { node, widget } = seedGroup()

      widget('loras.1').callback?.(undefined)
      widget('loras.$add').callback?.(undefined)
      await afterFlush()

      const setWidget = (name: string, value: unknown, old: unknown) => ({
        op: 'set_widget',
        node_id: node.id,
        widget: name,
        value,
        old
      })
      expect(minted).toEqual([
        setWidget('loras', 1, 2),
        setWidget('loras', 2, 1),
        setWidget('loras.1.lora_name', 'A', undefined),
        setWidget('loras.1.seed', 1, undefined),
        setWidget('loras.1.seed.0', 'randomize', undefined)
      ])
    })

    function seedThreeRows() {
      const seeded = seedGroup()
      const { widget } = seeded
      withGraphIntentSource('load', () => {
        widget('loras').value = 3
        widget('loras.0.seed').value = 10
        widget('loras.1.seed').value = 11
        widget('loras.1.seed.0').value = 'increment'
        widget('loras.2.seed').value = 12
        widget('loras.2.seed.0').value = 'decrement'
      })
      return seeded
    }

    it('mints the shifted field values after a middle row is removed', async () => {
      const { node, widget } = seedThreeRows()

      widget('loras.1').callback?.(undefined)
      await afterFlush()

      const setWidget = (name: string, value: unknown, old: unknown) => ({
        op: 'set_widget',
        node_id: node.id,
        widget: name,
        value,
        old
      })
      expect(minted).toEqual([
        setWidget('loras.1.lora_name', 'A', undefined),
        setWidget('loras.1.seed', 12, undefined),
        setWidget('loras.1.seed.0', 'decrement', undefined),
        setWidget('loras', 2, 3)
      ])
    })

    it('does not mint a shifted field whose rename was refused', async () => {
      const { node, widget } = seedThreeRows()
      vi.spyOn(useWidgetValueStore(), 'renameWidget').mockReturnValue(undefined)

      widget('loras.1').callback?.(undefined)
      await afterFlush()

      expect(minted).toEqual([
        {
          op: 'set_widget',
          node_id: node.id,
          widget: 'loras',
          value: 2,
          old: 3
        }
      ])
    })

    it.for(['agent-remote', 'load'] as const)(
      'mints nothing for a row removed by a %s write',
      async (source) => {
        const { widget } = seedThreeRows()

        withGraphIntentSource(source, () => {
          widget('loras.1').callback?.(undefined)
        })
        await afterFlush()

        expect(widget('loras.1.seed').value).toBe(12)
        expect(minted).toEqual([])
      }
    )

    it.for(['agent-remote', 'load'] as const)(
      'mints nothing for a row added by a %s write',
      async (source) => {
        const { widget } = seedGroup()

        withGraphIntentSource(source, () => {
          widget('loras').value = 3
        })
        await afterFlush()

        expect(widget('loras.2.lora_name').value).toBe('A')
        expect(minted).toEqual([])
      }
    )

    it('mints null for an added field that has no value', async () => {
      const node = new TestEmptyComboGroup()
      withGraphIntentSource('load', () => graph.add(node))

      node.widgets?.find((w) => w.name === 'loras.$add')?.callback?.(undefined)
      await afterFlush()

      expect(minted).toEqual([
        expect.objectContaining({ widget: 'loras', value: 1 }),
        expect.objectContaining({ widget: 'loras.0.lora_name', value: null })
      ])
    })

    it('mints nothing for a row added while the workflow is not doc-bound', async () => {
      const { widget } = seedGroup()
      bound = false

      widget('loras.$add').callback?.(undefined)
      await afterFlush()

      expect(widget('loras.2.lora_name').value).toBe('A')
      expect(minted).toEqual([])
    })
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

describe('wireNodeSnapshot widget form (schema A24)', () => {
  function nodeDef(
    name: string,
    required: NonNullable<ComfyNodeDefV1['input']>['required']
  ): ComfyNodeDefV1 {
    return {
      name,
      display_name: name,
      category: 'test',
      python_module: 'custom_nodes.test',
      description: '',
      input: { required },
      output: [],
      output_name: [],
      output_is_list: [],
      output_node: false
    }
  }

  function nodeWith(
    type: string,
    build: (node: LGraphNode) => void
  ): LGraphNode {
    const node = new LGraphNode(type, type)
    node.serialize_widgets = true
    build(node)
    return node
  }

  it.for([
    {
      case: 'an extension widget the definition does not describe',
      definitions: [
        nodeDef('Display Int', {
          input: ['INT', { forceInput: true }]
        })
      ],
      type: 'Display Int',
      build: (n: LGraphNode) => {
        n.addInput('input', 'INT')
        n.addWidget('text', 'output', '', () => {})
        n.addWidget('button', 'copy', 'copy', () => {})
      },
      values: { output: '' },
      order: ['output']
    },
    {
      case: 'widgets the definition fully describes',
      definitions: [nodeDef('Described', { steps: ['INT', {}] })],
      type: 'Described',
      build: (n: LGraphNode) => {
        n.addWidget('number', 'steps', 20, () => {})
      },
      values: { steps: 20 },
      order: ['steps']
    },
    {
      case: 'a companion linked to a described widget',
      definitions: [nodeDef('Seeded', { seed: ['INT', {}] })],
      type: 'Seeded',
      build: (n: LGraphNode) => {
        const seed = n.addWidget('number', 'seed', 1, () => {})
        const control = n.addWidget(
          'combo',
          'control_after_generate',
          'fixed',
          () => {},
          { values: ['fixed', 'randomize'] }
        )
        seed.linkedWidgets = [control]
      },
      values: { seed: 1, control_after_generate: 'fixed' },
      order: ['seed', 'control_after_generate']
    },
    {
      case: 'a class with no definition',
      definitions: [],
      type: 'Undefined Class',
      build: (n: LGraphNode) => {
        n.addWidget('text', 'output', '', () => {})
      },
      values: { output: '' },
      order: ['output']
    },
    {
      case: 'integer-like widget names',
      definitions: [],
      type: 'Integer Names',
      build: (n: LGraphNode) => {
        n.addWidget('text', '2', 'two', () => {})
        n.addWidget('text', '1', 'one', () => {})
      },
      values: { '2': 'two', '1': 'one' },
      order: ['2', '1']
    }
  ])(
    'declares the live widget order for $case',
    ({ definitions, type, build, values, order }) => {
      useNodeDefStore().updateNodeDefs(definitions)
      const node = nodeWith(type, build)

      expect(wireNodeSnapshot(node)).toMatchObject({
        widgets_values: values,
        widgets_values_form: { order }
      })
    }
  )

  it.for([
    {
      case: 'a dynamic combo input',
      definition: nodeDef('Dynamic', { mode: ['COMFY_DYNAMICCOMBO_V3', {}] }),
      build: (n: LGraphNode) => {
        n.addWidget('combo', 'mode', 'a', () => {}, { values: ['a'] })
        n.addWidget('number', 'mode.steps', 4, () => {})
      }
    },
    {
      case: 'a dynamic group input',
      definition: nodeDef('Dynamic', { mode: ['COMFY_DYNAMICGROUP_V3', {}] }),
      build: (n: LGraphNode) => {
        n.addWidget('number', 'mode.0.steps', 4, () => {})
      }
    },
    {
      case: 'an autogrow input',
      definition: nodeDef('Dynamic', { mode: ['COMFY_AUTOGROW_V3', {}] }),
      build: (n: LGraphNode) => {
        n.addWidget('number', 'mode.steps', 4, () => {})
      }
    },
    {
      case: 'no value widgets',
      definition: nodeDef('Dynamic', {}),
      build: (n: LGraphNode) => {
        n.addWidget('button', 'refresh', 'refresh', () => {})
      }
    },
    {
      case: 'an unnamed value widget',
      definition: nodeDef('Dynamic', {}),
      build: (n: LGraphNode) => {
        n.addWidget('text', 'prompt', 'a', () => {})
        n.addWidget('text', '', 'b', () => {})
      }
    },
    {
      case: 'two value widgets sharing a name',
      definition: nodeDef('Dynamic', {}),
      build: (n: LGraphNode) => {
        n.addWidget('text', 'prompt', 'a', () => {})
        n.addWidget('text', 'prompt', 'b', () => {})
      }
    }
  ])('declares no form for a node with $case', ({ definition, build }) => {
    useNodeDefStore().addNodeDef(definition)
    const node = nodeWith('Dynamic', build)

    expect(wireNodeSnapshot(node)).not.toHaveProperty('widgets_values_form')
  })

  it('declares the filtered form when serialization removes a widget', () => {
    useNodeDefStore().addNodeDef(nodeDef('Dynamic', {}))
    const node = nodeWith('Dynamic', (n) => {
      n.addWidget('text', 'prompt', 'a', () => {})
      n.addWidget('text', 'extra', 'b', () => {})
      new LGraph().add(n)
      n.onSerialize = () => {
        n.widgets?.pop()
      }
    })

    expect(wireNodeSnapshot(node)).toMatchObject({
      widgets_values: { prompt: 'a' },
      widgets_values_form: { order: ['prompt'] }
    })
  })

  it('declares the form for a node built by the real widget constructors', () => {
    const required = {
      seed: ['INT', { default: 1, control_after_generate: true }],
      sampler_name: [['euler', 'dpmpp_2m'], {}],
      model: ['MODEL', {}]
    } satisfies NonNullable<ComfyNodeDefV1['input']>['required']
    useNodeDefStore().addNodeDef(nodeDef('Real Sampler', required))
    const node = nodeWith('Real Sampler', (n) => {
      for (const [name, spec] of Object.entries(required))
        useLitegraphService().addNodeInput(
          n,
          transformInputSpecV1ToV2(spec, { name })
        )
    })

    expect(wireNodeSnapshot(node)?.widgets_values_form).toEqual({
      order: ['seed', 'control_after_generate', 'sampler_name']
    })
  })

  it('replaces a form the node carried in from a loaded projection with its live order', () => {
    useNodeDefStore().addNodeDef(nodeDef('Described', { steps: ['INT', {}] }))
    const node = nodeWith('Described', (n) => {
      n.addWidget('number', 'steps', 20, () => {})
    })
    node.configure(
      Object.assign(node.serialize(), {
        widgets_values_form: { order: ['steps', 'gone'] }
      })
    )

    expect(wireNodeSnapshot(node)?.widgets_values_form).toEqual({
      order: ['steps']
    })
  })

  it.for<{ catalogCase: string; catalog: WidgetCatalog }>([
    {
      catalogCase: 'lists no widgets for the class',
      catalog: { types: { Described: { widget_order: [] } } }
    },
    {
      catalogCase: 'does not list the class',
      catalog: { types: {} }
    }
  ])(
    'mints a described node the applier accepts when the catalog $catalogCase',
    ({ catalog }) => {
      useNodeDefStore().addNodeDef(nodeDef('Described', { steps: ['INT', {}] }))
      const node = nodeWith('Described', (n) => {
        n.addWidget('number', 'steps', 20, () => {})
      })
      const snapshot = wireNodeSnapshot(node)!
      const doc = mint({ nodes: [], links: [] }, catalog)

      const result = applyOps(
        doc,
        mintWireOps(
          [
            {
              op: 'add_node',
              node_id: snapshot.id,
              class_type: snapshot.type,
              pos: [0, 0],
              node: snapshot
            }
          ],
          {
            actor: 'human:user:tab',
            baseVersion: 1
          }
        ),
        catalog
      )

      expect(result.outcomes).toEqual([
        expect.objectContaining({ outcome: 'applied' })
      ])
      expect(project(doc, catalog).nodes).toEqual([
        expect.objectContaining({
          type: 'Described',
          widgets_values: { steps: 20 },
          widgets_values_form: { order: ['steps'] }
        })
      ])
      doc.destroy()
    }
  )

  it('keeps a catalogued dynamic combo writable after its selection changes', () => {
    useNodeDefStore().addNodeDef(
      nodeDef('Dynamic', { mode: ['COMFY_DYNAMICCOMBO_V3', {}] })
    )
    const node = nodeWith('Dynamic', (n) => {
      n.addWidget('combo', 'mode', 'a', () => {}, { values: ['a', 'b'] })
      n.addWidget('number', 'mode.steps', 4, () => {})
    })
    const catalog: WidgetCatalog = {
      types: {
        Dynamic: {
          widget_order: ['mode', 'mode.steps'],
          dynamic_combos: {
            mode: {
              default: 'a',
              options: {
                a: { widgets: ['mode.steps'], defaults: { 'mode.steps': 4 } },
                b: { widgets: ['mode.other'], defaults: { 'mode.other': 0 } }
              }
            }
          }
        }
      }
    }
    const snapshot = wireNodeSnapshot(node)!
    expect(snapshot).toMatchObject({
      widgets_values: { mode: 'a', 'mode.steps': 4 }
    })
    const doc = mint({ nodes: [], links: [] }, catalog)
    const operations: GraphOperation[] = [
      {
        op: 'add_node',
        node_id: node.id,
        class_type: 'Dynamic',
        pos: [0, 0],
        node: snapshot
      },
      { op: 'set_widget', node_id: node.id, widget: 'mode', value: 'b' },
      { op: 'set_widget', node_id: node.id, widget: 'mode.other', value: 7 }
    ]

    const { outcomes } = applyOps(
      doc,
      mintWireOps(operations, { actor: 'human:user:tab', baseVersion: 1 }),
      catalog
    )

    expect(outcomes.map((outcome) => outcome.outcome)).toEqual([
      'applied',
      'applied',
      'applied'
    ])
    expect(project(doc, catalog).nodes[0]?.widgets_values).toEqual(['b', 7])
    doc.destroy()
  })

  it('refuses an uncatalogued dynamic combo before accepting partial widget state', () => {
    useNodeDefStore().addNodeDef(
      nodeDef('Dynamic', { mode: ['COMFY_DYNAMICCOMBO_V3', {}] })
    )
    const node = nodeWith('Dynamic', (n) => {
      n.addWidget('combo', 'mode', 'a', () => {}, { values: ['a', 'b'] })
      n.addWidget('number', 'mode.steps', 4, () => {})
    })
    const snapshot = wireNodeSnapshot(node)!
    const catalog: WidgetCatalog = { types: {} }
    const doc = mint({ nodes: [], links: [] }, catalog)

    const { outcomes } = applyOps(
      doc,
      mintWireOps(
        [
          {
            op: 'add_node',
            node_id: node.id,
            class_type: 'Dynamic',
            pos: [0, 0],
            node: snapshot
          }
        ],
        { actor: 'human:user:tab', baseVersion: 1 }
      ),
      catalog
    )

    expect(outcomes).toEqual([
      expect.objectContaining({
        outcome: 'rejected',
        reason: expect.objectContaining({ code: 'uncatalogued_widget_write' })
      })
    ])
    expect(project(doc, catalog).nodes).toEqual([])
    doc.destroy()
  })
})
