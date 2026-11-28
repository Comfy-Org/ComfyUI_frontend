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

import { promoteWidget } from '@/core/graph/subgraph/promotionUtils'
import {
  bindPromotedDynamicInput,
  unbindPromotedDynamicInput
} from '@/core/graph/widgets/dynamicWidgets'
import { withGraphIntentSource } from '@/lib/litegraph/src/graphIntents'
import {
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { LGraph, Positionable } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useLitegraphService } from '@/services/litegraphService'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import { toRootGraphId } from '@comfyorg/graph-model/graphScopeId'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@comfyorg/object-info-parser'
import { reportError } from '@comfyorg/telemetry/reportError'

import * as Y from 'yjs'

import { mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ISerialisedGraph } from '@comfyorg/graph-model/serialisation'

import { readDocPromotedWidgets } from './agentSubgraphDefinitions'
import type { DocPromotedWidgets } from './agentSubgraphDefinitions'
import { DocChangeCollector } from './docChangeCollector'
import { attachDocOpMinter } from './docOpMinter'
import type { DocOpMinter } from './docOpMinter'
import type { GraphOperation } from './graphOperations'
import { LiveGraphApplier } from './liveGraphApplier'
import { promotedHostInputs } from './promotedHostInputs'

const COMBO_TYPE = 'test/TalkMode'
const INT_TYPE = 'test/TalkInt'

const comboDef: ComfyNodeDefV1 = {
  name: COMBO_TYPE,
  display_name: 'Talk Mode',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      mode: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'depth',
              inputs: { required: { normalization: ['INT', { default: 2 }] } }
            },
            {
              key: 'depth pro',
              inputs: { required: { normalization: ['INT', { default: 3 }] } }
            },
            {
              key: 'spectral',
              inputs: { required: { bandwidth: ['INT', { default: 11 }] } }
            },
            {
              key: 'two speakers',
              inputs: {
                required: { mask_1: ['MASK', {}], mask_2: ['MASK', {}] }
              }
            }
          ]
        }
      ]
    }
  },
  output: ['MODEL'],
  output_name: ['MODEL'],
  output_node: false
}

const intDef: ComfyNodeDefV1 = {
  ...comboDef,
  name: INT_TYPE,
  display_name: 'Talk Int',
  input: { required: { value: ['INT', { default: 4 }] } }
}

function newGraph(): LGraph {
  const graph = createTestRootGraph()
  const listener = (e: CustomEvent<{ subgraph: SubgraphNode['subgraph'] }>) => {
    const { subgraph } = e.detail
    class DynamicSubgraphNode extends SubgraphNode {
      constructor() {
        super(graph, subgraph, {
          id: -1,
          type: subgraph.id,
          pos: [0, 0],
          size: [100, 100],
          inputs: [],
          outputs: [],
          flags: {},
          mode: 0,
          order: 0
        })
      }
      protected override bindDynamicInput(
        input: INodeInputSlot,
        interiorNode: LGraphNode,
        interiorInput: INodeInputSlot
      ) {
        return bindPromotedDynamicInput(
          this,
          input,
          interiorNode,
          interiorInput
        )
      }
      protected override unbindDynamicInput(input: INodeInputSlot) {
        return unbindPromotedDynamicInput(this, input)
      }
    }
    LiteGraph.registered_node_types[subgraph.id] = DynamicSubgraphNode
    onTestFinished(() => {
      delete LiteGraph.registered_node_types[subgraph.id]
    })
  }
  graph.events.addEventListener('subgraph-created', listener)
  onTestFinished(() =>
    graph.events.removeEventListener('subgraph-created', listener)
  )
  return graph
}

function widget(node: LGraphNode, name: string) {
  const found = node.widgets?.find((w) => w.name === name)
  assert(found, `widget ${name} on ${node.type}`)
  return found
}

function toWorkflow({ nodes, ...serialized }: ISerialisedGraph): WorkflowJSON {
  return {
    ...serialized,
    nodes: nodes.map(({ flags, ...node }) => ({
      ...node,
      flags: { ...flags }
    }))
  }
}

function buildHost(option: string, others: number) {
  const graph = newGraph()
  const nodes: LGraphNode[] = []
  withGraphIntentSource('load', () => {
    const combo = LiteGraph.createNode(COMBO_TYPE)
    assert(combo)
    graph.add(combo)
    widget(combo, 'mode').value = option
    nodes.push(combo)
    for (let index = 0; index < others; index++) {
      const int = LiteGraph.createNode(INT_TYPE)
      assert(int)
      graph.add(int)
      nodes.push(int)
    }
  })
  let host: LGraphNode | undefined
  withGraphIntentSource('load', () => {
    const converted = graph.convertToSubgraph(new Set<Positionable>(nodes))
    host = converted.node
    for (const interior of converted.subgraph.nodes) {
      const name = interior.type === COMBO_TYPE ? 'mode' : 'value'
      promoteWidget(interior, widget(interior, name), [converted.node])
    }
  })
  assert(host?.isSubgraphNode())
  return { graph, host }
}

describe('promoted writes on a host that owns a dynamic combo', () => {
  let graph: LGraph
  let minted: GraphOperation[]
  let minter: DocOpMinter | undefined
  let doc: DocPromotedWidgets | null

  beforeEach(async () => {
    for (const def of [comboDef, intDef])
      await useLitegraphService().registerNodeDef(def.name, def)
    minted = []
    doc = null
  })

  afterEach(() => minter?.detach())

  function attach(target: LGraph) {
    graph = target
    minter = attachDocOpMinter({
      isEnabled: () => true,
      isBoundWorkflow: () => true,
      isDocBound: () => true,
      enqueue: (operations) => minted.push(...operations),
      getGraph: () => graph,
      boundRootGraphId: () => toRootGraphId(graph.id),
      docInputNames: () => null,
      docWidgetValue: () => undefined,
      docPromotedWidgets: () => doc,
      mayWritePromotedHost: () => true,
      docHasSubgraphDefinition: () => true,
      onWidgetWriteRefused: () => {}
    })
  }

  function flush(): Promise<void> {
    return new Promise((resolve) => queueMicrotask(resolve))
  }

  function promotedWrites() {
    return minted.flatMap((operation) =>
      operation.op === 'set_widget' && 'promoted' in operation
        ? [operation]
        : []
    )
  }

  function onlyPromotedWrite() {
    const writes = promotedWrites()
    expect(writes).toHaveLength(1)
    const [write] = writes
    const { promoted } = write
    assert(promoted)
    return { ...write, promoted }
  }

  function driftReports() {
    return vi
      .mocked(reportError)
      .mock.calls.filter(
        ([, meta]) =>
          meta.errorType === 'agent_crdt_promoted_widget_order_drift' ||
          meta.errorType === 'agent_crdt_promoted_widget_not_promoted'
      )
  }

  it('lists the host-owned combo in the order the host saves its values', () => {
    const { host } = buildHost('two speakers', 2)
    const promoted = promotedHostInputs(host)

    expect(promoted.map(({ input }) => input.name)).toEqual([
      'mode',
      'value',
      'value_1'
    ])
    expect(promoted.map(({ readValue }) => readValue())).toEqual(
      host.serialize().widgets_values
    )
  })

  it('keeps prompt-only legacy inputs out of workflow positions', () => {
    const host = new LGraphNode('Prompt-only host')
    const input = host.addInput('prompt', 'INT')
    input.widget = { name: 'prompt' }
    const prompt = host.addWidget('number', 'prompt', 7, () => {})
    prompt.serialize = false
    prompt.options.serialize = true

    const promoted = promotedHostInputs(host)

    expect(promoted).toEqual([])
    expect(host.serialize().widgets_values).toBeUndefined()
  })

  it('keeps later host positions aligned when a controller is prompt-only', () => {
    const { host } = buildHost('two speakers', 2)
    const mode = widget(host, 'mode')
    mode.serialize = false
    mode.options.serialize = true

    const promoted = promotedHostInputs(host)

    expect(promoted.map(({ readValue }) => readValue())).toEqual(
      host.serialize().widgets_values
    )
  })

  it('counts the combo option widgets the host owns after the combo', () => {
    const { host } = buildHost('depth', 1)
    const promoted = promotedHostInputs(host)

    expect(promoted.map(({ input }) => input.name)).toEqual([
      'mode',
      'mode.normalization',
      'value'
    ])
    expect(promoted.map(({ readValue }) => readValue())).toEqual(
      host.serialize().widgets_values
    )
  })

  it.for(['two speakers', 'depth'])(
    'agrees with the document minted from its own save (%s)',
    (option) => {
      const { graph: built, host } = buildHost(option, 2)
      const catalog: WidgetCatalog = {
        types: {
          [COMBO_TYPE]: { widget_order: ['mode'] },
          [INT_TYPE]: { widget_order: ['value'] }
        }
      }
      const minted = mint(toWorkflow(built.serialize()), catalog)
      onTestFinished(() => minted.destroy())
      const live = promotedHostInputs(host).map(({ input }) => input.name)

      expect(readDocPromotedWidgets(minted, String(host.id))).toMatchObject({
        valueCount: live.length,
        promotedNames: live
      })
    }
  )

  it('mints a write on host 188 whose document promotes mode first (3Q7)', async () => {
    const { graph: built, host } = buildHost('two speakers', 12)
    const expectedNames = [
      'mode',
      'value',
      'value_1',
      'value_2',
      'value_3',
      'value_4',
      'value_5',
      'value_6',
      'value_7',
      'value_8',
      'value_9',
      'value_10',
      'value_11'
    ]
    doc = {
      valueCount: 13,
      declaredNames: [
        'start_image',
        'mode.mask_1',
        'mode.mask_2',
        ...expectedNames
      ],
      promotedNames: expectedNames
    }
    attach(built)

    widget(host, 'value_3').value = 9
    await flush()

    expect(driftReports()).toEqual([])
    const write = onlyPromotedWrite()
    expect(write.promoted.value_index).toBe(4)
    expect(write.promoted.host_widgets_values[0]).toBe('two speakers')
    expect(write.promoted.host_widgets_values).toHaveLength(13)
  })

  const HOST_14_DOC: DocPromotedWidgets = {
    valueCount: 4,
    declaredNames: ['video', 'mode', 'mode.normalization', 'value', 'value_1'],
    promotedNames: ['mode', 'mode.normalization', 'value', 'value_1']
  }

  it('mints a write to the combo itself on host 14 (3NC)', async () => {
    const { graph: built, host } = buildHost('depth', 2)
    doc = HOST_14_DOC
    attach(built)

    widget(host, 'mode').value = 'depth pro'
    await flush()

    expect(driftReports()).toEqual([])
    const write = onlyPromotedWrite()
    expect(write.promoted.value_index).toBe(0)
    expect(write.value).toBe('depth pro')
    expect(promotedHostInputs(host).map(({ input }) => input.name)).toEqual(
      HOST_14_DOC.promotedNames
    )
    expect(write.promoted.host_widgets_values).toEqual([undefined, 3, 4, 4])
    expect(widget(host, 'mode.normalization').value).toBe(3)
  })

  it('refuses a combo write that changes which option widgets the host owns', async () => {
    const { graph: built, host } = buildHost('depth', 2)
    doc = HOST_14_DOC
    attach(built)

    widget(host, 'mode').value = 'two speakers'
    await flush()

    expect(promotedHostInputs(host).map(({ input }) => input.name)).toEqual([
      'mode',
      'value',
      'value_1'
    ])
    expect(promotedWrites()).toEqual([])
    expect(
      vi.mocked(reportError).mock.calls.map(([, meta]) => meta.errorType)
    ).toEqual(['agent_crdt_promoted_widget_layout_changed'])
  })

  it('addresses a combo option widget by its slot in the host array (3P1)', async () => {
    const { graph: built, host } = buildHost('depth', 2)
    doc = HOST_14_DOC
    attach(built)

    widget(host, 'mode.normalization').value = 5
    await flush()

    expect(driftReports()).toEqual([])
    const write = onlyPromotedWrite()
    expect(write.widget).toBe('mode.normalization')
    expect(write.promoted.value_index).toBe(1)
    expect(write.promoted.host_widgets_values).toEqual([
      'depth',
      undefined,
      4,
      4
    ])
  })

  it('carries an owned numeric option as a companion value', async () => {
    const { graph: built, host } = buildHost('depth', 2)
    doc = HOST_14_DOC
    attach(built)

    widget(host, 'value').value = 7
    await flush()

    expect(driftReports()).toEqual([])
    const write = onlyPromotedWrite()
    expect(write.promoted.value_index).toBe(2)
    expect(write.promoted.host_widgets_values).toEqual([
      'depth',
      2,
      undefined,
      4
    ])
  })

  it('places the rest of a document array by name when a remote combo write rebuilds the host', () => {
    const { graph: built, host } = buildHost('depth', 1)
    const catalog: WidgetCatalog = {
      types: {
        [COMBO_TYPE]: { widget_order: ['mode'] },
        [INT_TYPE]: { widget_order: ['value'] }
      }
    }
    expect(promotedHostInputs(host).map(({ input }) => input.name)).toEqual([
      'mode',
      'mode.normalization',
      'value'
    ])
    const saved = toWorkflow(built.serialize())
    const hostDoc = mint(
      {
        ...saved,
        nodes: saved.nodes.map((node) =>
          String(node.id) === String(host.id)
            ? { ...node, widgets_values: ['spectral', 5, 9] }
            : node
        )
      },
      catalog
    )
    onTestFinished(() => hostDoc.destroy())

    const follower = new Y.Doc()
    const collector = new DocChangeCollector(follower)
    onTestFinished(() => {
      collector.destroy()
      follower.destroy()
    })
    Y.applyUpdate(follower, Y.encodeStateAsUpdate(hostDoc))
    const applier = new LiveGraphApplier({ getGraph: () => built })
    const changes = collector.take()
    applier.applyChanges(follower, changes, {
      actor: 'agent:test:turn',
      opIds: []
    })

    expect(promotedHostInputs(host).map(({ input }) => input.name)).toEqual([
      'mode',
      'mode.bandwidth',
      'value'
    ])
    expect(widget(host, 'mode').value).toBe('spectral')
    expect(widget(host, 'value').value).toBe(9)
    expect(widget(host, 'mode.bandwidth').value).toBe(11)
    expect(
      vi
        .mocked(reportError)
        .mock.calls.filter(
          ([, meta]) => meta.errorType === 'agent_graph_host_widgets_rebuilt'
        )
    ).toHaveLength(1)

    applier.applyChanges(follower, changes, {
      actor: 'agent:test:turn',
      opIds: []
    })

    expect(widget(host, 'mode.bandwidth').value).toBe(11)
    expect(widget(host, 'value').value).toBe(9)
    expect(
      vi
        .mocked(reportError)
        .mock.calls.filter(
          ([, meta]) => meta.errorType === 'agent_graph_host_widgets_mismatch'
        )
    ).toHaveLength(1)
  })

  it('names a nested option widget once, under its nearest declared parent', () => {
    const { graph: built, host } = buildHost('depth', 1)
    const catalog: WidgetCatalog = {
      types: {
        [COMBO_TYPE]: { widget_order: ['mode'] },
        [INT_TYPE]: { widget_order: ['value'] }
      }
    }
    const saved = toWorkflow(built.serialize())
    const nested = {
      ...saved,
      nodes: saved.nodes.map((node) =>
        String(node.id) === String(host.id)
          ? {
              ...node,
              inputs: ['mode', 'mode.sub', 'mode.sub.x', 'value'].map(
                (name) => ({ name, type: 'INT', widget: { name }, link: null })
              ),
              widgets_values: ['depth', 1, 2, 4]
            }
          : node
      ),
      definitions: {
        subgraphs: (saved.definitions?.subgraphs ?? []).map((definition) => ({
          ...(definition as Record<string, unknown>),
          inputs: ['mode', 'mode.sub', 'value'].map((name, index) => ({
            id: `0000000${index}-0000-4000-8000-00000000000${index}`,
            name,
            type: 'INT'
          }))
        }))
      }
    } as unknown as WorkflowJSON
    const hostDoc = mint(nested, catalog)
    onTestFinished(() => hostDoc.destroy())

    expect(readDocPromotedWidgets(hostDoc, String(host.id))).toMatchObject({
      promotedNames: ['mode', 'mode.sub', 'mode.sub.x', 'value']
    })
  })

  it('still refuses a document array saved before the host owned the option widgets', async () => {
    const { graph: built, host } = buildHost('depth', 2)
    doc = {
      valueCount: 3,
      declaredNames: [
        'video',
        'mode',
        'mode.normalization',
        'value',
        'value_1'
      ],
      promotedNames: ['mode', 'value', 'value_1']
    }
    attach(built)

    widget(host, 'value_1').value = 11
    await flush()

    expect(promotedWrites()).toEqual([])
    expect(driftReports().map(([, meta]) => meta.errorType)).toEqual([
      'agent_crdt_promoted_widget_order_drift'
    ])
  })
})
