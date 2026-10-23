import { applyOps, mint, project } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import * as Y from 'yjs'
import { z } from 'zod'

import { withGraphIntentSource } from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import { useLitegraphService } from '@/services/litegraphService'
import { toRootGraphId } from '@/types/graphScopeId'

import { DocChangeCollector } from './docChangeCollector'
import { attachDocOpMinter } from './docOpMinter'
import type { DocOpMinter } from './docOpMinter'
import type { GraphOperation } from './graphOperations'
import {
  LiveGraphApplier,
  readDocSlotNames,
  readDocWidgetValue
} from './liveGraphApplier'
import { mintWireOps } from './opEnvelope'

vi.mock(import('@/platform/telemetry/reportError'))

const IMAGES = 'model.images'

class TestSource extends LGraphNode {
  constructor() {
    super('Test Source')
    this.addOutput('IMAGE', 'IMAGE')
  }
}

class TestFloatSource extends LGraphNode {
  constructor() {
    super('Test Float Source')
    this.addOutput('FLOAT', 'FLOAT')
  }
}

class TestSink extends LGraphNode {
  constructor() {
    super('Test Sink')
    this.addInput('mask', 'MASK')
    this.addInput('image', 'IMAGE')
  }
}

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
              names: ['image_1', 'image_2', 'image_3', 'image_4'],
              min: 0
            }
          }
        ],
        { name: IMAGES, isOptional: false }
      )
    )
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
      template: { required: { strength: ['FLOAT', { default: 1 }] } }
    })
  }
}

const NODE_TYPES = {
  TestSource,
  TestFloatSource,
  TestSink,
  TestAutogrowSink,
  TestDynamicGroup
}

const CATALOG: WidgetCatalog = {
  types: {
    TestSource: { widget_order: [] },
    TestSink: { widget_order: [] },
    TestAutogrowSink: { widget_order: [] }
  }
}

const zLink = z.tuple([z.number(), z.coerce.string()]).rest(z.unknown())
const zDocInputs = z.array(
  z.object({ name: z.string(), link: z.number().nullable() })
)

type NodeType = keyof typeof NODE_TYPES

function addNode(graph: LGraph, type: NodeType): LGraphNode {
  const node = LiteGraph.createNode(type)
  assert.exists(node)
  graph.add(node)
  return node
}

function setWidget(node: LGraphNode, name: string, value: number): void {
  const widget = node.widgets?.find((candidate) => candidate.name === name)
  assert.exists(widget)
  widget.value = value
}

function afterFlush(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

function docSlotsBySource(
  doc: Y.Doc,
  sinkId: unknown,
  sources: readonly LGraphNode[]
) {
  const workflow = project(doc, CATALOG)
  const origins = new Map(
    workflow.links.map((link) => {
      const [id, originId] = zLink.parse(link)
      return [id, sources.findIndex((source) => String(source.id) === originId)]
    })
  )
  const sink = workflow.nodes.find((node) => String(node.id) === String(sinkId))
  assert.exists(sink)
  return zDocInputs
    .parse(sink.inputs)
    .map(({ name, link }) => [
      name,
      link === null ? null : (origins.get(link) ?? 'dangling')
    ])
}

function liveLinksBySource(
  graph: LGraph,
  docSink: LGraphNode,
  sources: readonly LGraphNode[]
) {
  const sink = graph.getNodeById(docSink.id)
  assert.exists(sink)
  return sink.inputs.flatMap((input) => {
    const link = input.link === null ? undefined : graph.getLink(input.link)
    if (!link) return []
    const source = sources.findIndex(
      (node) => String(node.id) === String(link.origin_id)
    )
    return [`${source} -> ${input.name}`]
  })
}

function describeOp(operation: GraphOperation): string {
  if (operation.op === 'connect')
    return operation.grow
      ? `connect grow ${operation.grow.name}${operation.grow.widget ? ' (widget)' : ''}`
      : `connect ${operation.to_slot}`
  if (operation.op === 'disconnect') return `disconnect ${operation.to_slot}`
  return operation.op
}

function reportedErrorTypes(): string[] {
  return vi.mocked(reportError).mock.calls.map(([, meta]) => meta.errorType)
}

function remoteGrow(
  sink: LGraphNode,
  source: LGraphNode,
  name: string,
  linkId: number,
  stampCounter: number
): Op[] {
  return mintWireOps(
    [
      {
        op: 'connect',
        link_id: linkId,
        from_node: source.id,
        from_slot: 0,
        to_node: sink.id,
        to_slot: null,
        link_type: 'IMAGE',
        grow: { name, type: 'IMAGE' }
      }
    ],
    { actor: 'agent:other', baseVersion: stampCounter }
  )
}

function follow(host: Y.Doc) {
  const doc = new Y.Doc()
  const collector = new DocChangeCollector(doc)
  const graph = new LGraph()
  const applier = new LiveGraphApplier({ getGraph: () => graph })
  onTestFinished(() => {
    collector.destroy()
    doc.destroy()
  })
  function sync(mode: 'merge' | 'replace') {
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(host))
    applier.applyChanges(
      doc,
      collector.take(),
      { actor: 'agent:other', opIds: [] },
      mode
    )
  }
  return { graph, sync }
}

beforeEach(() => {
  for (const [type, constructor] of Object.entries(NODE_TYPES))
    LiteGraph.registerNodeType(type, constructor)
})

describe('a local link edit lands on the document slot that carries its input', () => {
  let minter: DocOpMinter | undefined

  afterEach(() => minter?.detach())

  function bind(
    sinkType: NodeType,
    sourceType: NodeType,
    seed: (sources: LGraphNode[], sink: LGraphNode) => void,
    shapeDoc: (workflow: WorkflowJSON) => WorkflowJSON = (workflow) => workflow
  ) {
    const graph = new LGraph()
    let sources: LGraphNode[] = []
    let sink: LGraphNode | undefined
    withGraphIntentSource('load', () => {
      sources = [0, 1, 2].map(() => addNode(graph, sourceType))
      sink = addNode(graph, sinkType)
      seed(sources, sink)
    })
    assert.exists(sink)
    const doc = mint(
      shapeDoc(graph.serialize() as unknown as WorkflowJSON),
      CATALOG
    )
    onTestFinished(() => doc.destroy())
    const unsent: GraphOperation[] = []
    const outcomes: string[] = []
    minter = attachDocOpMinter({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => unsent.push(...operations),
      getGraph: () => graph,
      boundRootGraphId: () => toRootGraphId(graph.id),
      docInputNames: (nodeId) =>
        readDocSlotNames(doc, String(nodeId), 'inputs'),
      docWidgetValue: (nodeId, widgetName) =>
        readDocWidgetValue(doc, String(nodeId), widgetName),
      docPromotedWidgets: () => null,
      mayWritePromotedHost: () => true,
      docHasSubgraphDefinition: () => false,
      onWidgetWriteRefused: () => {}
    })
    let stampCounter = 1
    function echo() {
      const ops = unsent.splice(0).flatMap((operation) =>
        mintWireOps([operation], {
          actor: 'human:user:tab',
          baseVersion: ++stampCounter
        })
      )
      const result = applyOps(doc, ops, CATALOG)
      outcomes.push(...result.outcomes.map(({ outcome }) => outcome))
    }
    function refuse() {
      minter?.forgetUnappliedGrows(
        mintWireOps(unsent.splice(0), {
          actor: 'human:user:tab',
          baseVersion: ++stampCounter
        })
      )
    }
    function foreignAppend(name: string) {
      assert.exists(sink)
      applyOps(doc, remoteGrow(sink, sources[0], name, 9001, 1), CATALOG)
    }
    return {
      graph,
      sources,
      sink,
      doc,
      unsent,
      outcomes,
      echo,
      refuse,
      foreignAppend
    }
  }

  type Bench = ReturnType<typeof bind>

  const reversedSinkInputs = (workflow: WorkflowJSON): WorkflowJSON => ({
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.type === 'TestSink'
        ? { ...node, inputs: [...(node.inputs ?? [])].reverse() }
        : node
    )
  })
  const withoutSinkInputs = (workflow: WorkflowJSON): WorkflowJSON => ({
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.type === 'TestSink' ? { ...node, inputs: [] } : node
    )
  })
  const noLinks = () => {}
  const firstImageWired = (sources: LGraphNode[], sink: LGraphNode) => {
    sources[0].connect(0, sink, 0)
  }

  it.for<{
    name: string
    sink: NodeType
    source?: NodeType
    seed: (sources: LGraphNode[], sink: LGraphNode) => void
    shapeDoc?: (workflow: WorkflowJSON) => WorkflowJSON
    act: (bench: Bench) => Promise<void>
    sent: string[]
    docSlots: [string, number | null][]
    reported: string[]
  }>([
    {
      name: 'a static input addresses the document slot of its name, not its live index',
      sink: 'TestSink',
      seed: noLinks,
      shapeDoc: reversedSinkInputs,
      act: async ({ sources, sink }) => {
        sources[0].connect(0, sink, 1)
        await afterFlush()
      },
      sent: ['connect 0'],
      docSlots: [
        ['image', 0],
        ['mask', null]
      ],
      reported: []
    },
    {
      name: 'a static input the document lacks is reported, not minted',
      sink: 'TestSink',
      seed: noLinks,
      shapeDoc: withoutSinkInputs,
      act: async ({ sources, sink }) => {
        sources[0].connect(0, sink, 1)
        await afterFlush()
      },
      sent: [],
      docSlots: [],
      reported: ['agent_crdt_link_slot_not_in_doc']
    },
    {
      name: 'an autogrow slot the document already carries is addressed by index',
      sink: 'TestAutogrowSink',
      seed: firstImageWired,
      act: async ({ sources, sink }) => {
        sources[1].connect(0, sink, 1)
        await afterFlush()
      },
      sent: ['connect 1'],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1]
      ],
      reported: []
    },
    {
      name: 'an autogrow slot the document lacks is grown',
      sink: 'TestAutogrowSink',
      seed: firstImageWired,
      act: async ({ sources, sink, echo }) => {
        sources[1].connect(0, sink, 1)
        await afterFlush()
        echo()
        sources[2].connect(0, sink, 2)
        await afterFlush()
      },
      sent: [`connect grow ${IMAGES}.image_3`],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1],
        [`${IMAGES}.image_3`, 2]
      ],
      reported: []
    },
    {
      name: '#21316: a DynamicGroup row field the document lacks grows its widget socket',
      sink: 'TestDynamicGroup',
      source: 'TestFloatSource',
      seed: (_sources, sink) => {
        setWidget(sink, 'loras', 1)
      },
      act: async ({ sources, sink }) => {
        withGraphIntentSource('agent-remote', () => setWidget(sink, 'loras', 2))
        sources[0].connect(0, sink, 1)
        await afterFlush()
      },
      sent: ['connect grow loras.1.strength (widget)'],
      docSlots: [
        ['loras.0.strength', null],
        ['loras.1.strength', 0]
      ],
      reported: []
    },
    {
      name: '#21250: a disconnect before the grow echoes targets the pending slot',
      sink: 'TestAutogrowSink',
      seed: firstImageWired,
      act: async ({ sources, sink, echo }) => {
        sources[1].connect(0, sink, 1)
        await afterFlush()
        echo()
        sources[2].connect(0, sink, 2)
        await afterFlush()
        sink.disconnectInput(2)
        await afterFlush()
      },
      sent: [`connect grow ${IMAGES}.image_3`, 'disconnect 2'],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1],
        [`${IMAGES}.image_3`, null]
      ],
      reported: []
    },
    {
      name: '#21250: a replacing link before the echo wires into the pending slot instead of growing again',
      sink: 'TestAutogrowSink',
      seed: firstImageWired,
      act: async ({ sources, sink, echo }) => {
        sources[1].connect(0, sink, 1)
        await afterFlush()
        echo()
        sources[2].connect(0, sink, 2)
        await afterFlush()
        sources[0].connect(0, sink, 2)
        await afterFlush()
      },
      sent: [`connect grow ${IMAGES}.image_3`, 'connect 2'],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1],
        [`${IMAGES}.image_3`, 0]
      ],
      reported: []
    },
    {
      name: '#21250: once the grow echoes the slot resolves by name again',
      sink: 'TestAutogrowSink',
      seed: firstImageWired,
      act: async ({ sources, sink, echo }) => {
        sources[1].connect(0, sink, 1)
        await afterFlush()
        echo()
        sources[2].connect(0, sink, 2)
        await afterFlush()
        echo()
        sources[0].connect(0, sink, 2)
        await afterFlush()
      },
      sent: ['connect 2'],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1],
        [`${IMAGES}.image_3`, 0]
      ],
      reported: []
    },
    {
      name: '#21250: two unechoed grows on one node address the later one after the earlier',
      sink: 'TestAutogrowSink',
      seed: noLinks,
      act: async ({ sources, sink }) => {
        sources.forEach((source, slot) => source.connect(0, sink, slot))
        await afterFlush()
        sink.disconnectInput(2)
        await afterFlush()
      },
      sent: [
        'connect 0',
        `connect grow ${IMAGES}.image_2`,
        `connect grow ${IMAGES}.image_3`,
        'disconnect 2'
      ],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1],
        [`${IMAGES}.image_3`, null]
      ],
      reported: []
    },
    {
      name: '#21250: a foreign slot landing first drops the prediction and reports instead of mis-targeting',
      sink: 'TestAutogrowSink',
      seed: firstImageWired,
      act: async ({ sources, sink, echo, foreignAppend }) => {
        sources[1].connect(0, sink, 1)
        await afterFlush()
        echo()
        sources[2].connect(0, sink, 2)
        await afterFlush()
        foreignAppend(`${IMAGES}.image_4`)
        sink.disconnectInput(2)
        await afterFlush()
      },
      sent: [`connect grow ${IMAGES}.image_3`],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1],
        [`${IMAGES}.image_4`, 0],
        [`${IMAGES}.image_3`, 2]
      ],
      reported: ['agent_crdt_link_slot_not_in_doc']
    },
    {
      name: '#21250: a replacing link after a foreign slot lands is reported, not grown a second time',
      sink: 'TestAutogrowSink',
      seed: firstImageWired,
      act: async ({ sources, sink, echo, foreignAppend }) => {
        sources[1].connect(0, sink, 1)
        await afterFlush()
        echo()
        sources[2].connect(0, sink, 2)
        await afterFlush()
        foreignAppend(`${IMAGES}.image_4`)
        sources[0].connect(0, sink, 2)
        await afterFlush()
      },
      sent: [`connect grow ${IMAGES}.image_3`],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1],
        [`${IMAGES}.image_4`, 0],
        [`${IMAGES}.image_3`, 2]
      ],
      reported: ['agent_crdt_link_slot_not_in_doc']
    },
    {
      name: 'a grow the host never applies frees its name for a fresh grow',
      sink: 'TestAutogrowSink',
      seed: firstImageWired,
      act: async ({ sources, sink, echo, refuse }) => {
        sources[1].connect(0, sink, 1)
        await afterFlush()
        echo()
        sources[2].connect(0, sink, 2)
        await afterFlush()
        refuse()
        sources[0].connect(0, sink, 2)
        await afterFlush()
      },
      sent: [`connect grow ${IMAGES}.image_3`],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1],
        [`${IMAGES}.image_3`, 0]
      ],
      reported: []
    },
    {
      name: '#21250: a grow cancelled with its unsent source leaves the slot to the next grow',
      sink: 'TestAutogrowSink',
      seed: firstImageWired,
      act: async ({ graph, sources, sink, echo }) => {
        sources[1].connect(0, sink, 1)
        await afterFlush()
        echo()
        const unsentSource = addNode(graph, 'TestSource')
        unsentSource.connect(0, sink, 2)
        graph.remove(unsentSource)
        await afterFlush()
        sources[2].connect(0, sink, 2)
        await afterFlush()
      },
      sent: [`connect grow ${IMAGES}.image_3`],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_2`, 1],
        [`${IMAGES}.image_3`, 2]
      ],
      reported: []
    },
    {
      name: '#21250: a queued disconnect follows its grow when an earlier grow is cancelled',
      sink: 'TestAutogrowSink',
      seed: noLinks,
      act: async ({ graph, sources, sink, echo }) => {
        sources[0].connect(0, sink, 0)
        await afterFlush()
        echo()
        const unsentSource = addNode(graph, 'TestSource')
        unsentSource.connect(0, sink, 1)
        sources[1].connect(0, sink, 2)
        sink.disconnectInput(2)
        graph.remove(unsentSource)
        await afterFlush()
      },
      sent: [`connect grow ${IMAGES}.image_3`, 'disconnect 1'],
      docSlots: [
        [`${IMAGES}.image_1`, 0],
        [`${IMAGES}.image_3`, null]
      ],
      reported: []
    }
  ])(
    '$name',
    async ({
      sink: sinkType,
      source = 'TestSource',
      seed,
      shapeDoc,
      act,
      sent,
      docSlots,
      reported
    }) => {
      const bench = bind(sinkType, source, seed, shapeDoc)

      await act(bench)
      const unacknowledged = bench.unsent.map(describeOp)
      bench.echo()

      expect(unacknowledged).toEqual(sent)
      expect(bench.outcomes.filter((outcome) => outcome !== 'applied')).toEqual(
        []
      )
      expect(docSlotsBySource(bench.doc, bench.sink.id, bench.sources)).toEqual(
        docSlots
      )
      expect(reportedErrorTypes()).toEqual(reported)
    }
  )

  it('FE-2682: a hand-wired grown autogrow link keeps its origin when a tab reloads from the document', async () => {
    const { sources, sink, doc, echo } = bind(
      'TestAutogrowSink',
      'TestSource',
      (sources, sink) => sources[0].connect(0, sink, 0)
    )
    sources[1].connect(0, sink, 1)
    await afterFlush()
    echo()
    sources[2].connect(0, sink, 2)
    await afterFlush()
    echo()

    const reloaded = follow(doc)
    reloaded.sync('replace')

    expect(liveLinksBySource(reloaded.graph, sink, sources)).toEqual([
      `0 -> ${IMAGES}.image_1`,
      `1 -> ${IMAGES}.image_2`,
      `2 -> ${IMAGES}.image_3`
    ])
  })
})

describe('a document link lands on the live input it names', () => {
  it.for<{
    name: string
    grows: (sink: LGraphNode, sources: LGraphNode[]) => Op[]
    live: string[]
  }>([
    {
      name: 'FE-2682: a slot the host grew is grown live to carry its link',
      grows: (sink, [, , source]) =>
        remoteGrow(sink, source, `${IMAGES}.image_3`, 501, 2),
      live: [`0 -> ${IMAGES}.image_1`, `2 -> ${IMAGES}.image_3`]
    },
    {
      name: 'two slots the host grew are grown live in document order',
      grows: (sink, [, first, second]) => [
        ...remoteGrow(sink, first, `${IMAGES}.image_3`, 501, 2),
        ...remoteGrow(sink, second, `${IMAGES}.image_4`, 502, 3)
      ],
      live: [
        `0 -> ${IMAGES}.image_1`,
        `1 -> ${IMAGES}.image_3`,
        `2 -> ${IMAGES}.image_4`
      ]
    },
    {
      name: 'a grown name outside the node autogrow groups stays unresolved instead of taking its index',
      grows: (sink, [, , source]) =>
        remoteGrow(sink, source, 'not_a_group.image_3', 501, 2),
      live: [`0 -> ${IMAGES}.image_1`]
    }
  ])('$name', ({ grows, live }) => {
    const seeded = new LGraph()
    let sources: LGraphNode[] = []
    let sink: LGraphNode | undefined
    withGraphIntentSource('load', () => {
      sources = [0, 1, 2].map(() => addNode(seeded, 'TestSource'))
      sink = addNode(seeded, 'TestAutogrowSink')
      sources[0].connect(0, sink, 0)
    })
    assert.exists(sink)
    const host = mint(seeded.serialize() as unknown as WorkflowJSON, CATALOG)
    onTestFinished(() => host.destroy())
    const tab = follow(host)
    tab.sync('replace')

    applyOps(host, grows(sink, sources), CATALOG)
    tab.sync('merge')

    expect(liveLinksBySource(tab.graph, sink, sources)).toEqual(live)
  })
})
