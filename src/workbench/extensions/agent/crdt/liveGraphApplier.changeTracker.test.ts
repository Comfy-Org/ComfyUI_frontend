import { applyOps, nodesMap } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { markRaw, ref } from 'vue'
import * as Y from 'yjs'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { MAX_DYNAMIC_GROUP_ROWS } from '@/core/graph/widgets/dynamicGroupDiagnostics'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { LGraphCanvasEventMap } from '@/lib/litegraph/src/infrastructure/LGraphCanvasEventMap'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { toNodeId } from '@/types/nodeId'
import { toRootGraphId } from '@/types/graphScopeId'
import { useLitegraphService } from '@/services/litegraphService'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'
import { attachDocOpMinter, wireNodeSnapshot } from './docOpMinter'
import { mintWireOps } from './opEnvelope'

const appState = vi.hoisted(() => ({
  rootGraph: undefined as LGraph | undefined
}))

vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))
vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({
    nodeOutputs: {},
    nodePreviewImages: {},
    isGraphReady: true,
    get rootGraph() {
      return appState.rootGraph
    },
    canvas: { ds: { scale: 1, offset: [0, 0] } },
    ui: { autoQueueEnabled: false, autoQueueMode: 'instant' }
  })
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/telemetry/reportError'))

class TestSource extends LGraphNode {
  constructor() {
    super('Test Source')
    this.addWidget('number', 'steps', 20, () => {})
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

class DynamicGroupTest extends LGraphNode {
  constructor() {
    super('DynamicGroupTest')
    this.comfyClass = 'DynamicGroupTest'
    this.serialize_widgets = true
    this.addWidget('text', 'before', 'head', () => {})
    useLitegraphService().addNodeInput(this, {
      name: 'rows',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      min: 0,
      max: 3,
      template: { required: { strength: ['FLOAT', { default: 1 }] } }
    })
    this.addWidget('text', 'after', 'tail', () => {})
  }
}

class DynamicGroupOverflowTest extends LGraphNode {
  constructor() {
    super('DynamicGroupOverflowTest')
    this.comfyClass = 'DynamicGroupOverflowTest'
    this.serialize_widgets = true
    this.addWidget('text', 'before', 'head', () => {})
    useLitegraphService().addNodeInput(this, {
      name: 'rows',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      min: 0,
      max: 3,
      template: { required: { strength: ['FLOAT', { default: 1 }] } }
    })
  }
}

class DynamicGroupOverflowTrailingTest extends DynamicGroupOverflowTest {
  constructor() {
    super()
    this.comfyClass = 'DynamicGroupOverflowTrailingTest'
    this.addWidget('text', 'after', 'tail', () => {})
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestSource: { widget_order: ['steps'] },
    TestSink: { widget_order: [] },
    DynamicGroupTest: {
      widget_order: [
        'before',
        'rows',
        'rows.0.strength',
        'rows.1.strength',
        'after'
      ]
    }
  }
}
const CONTEXT = { actor: 'agent:test', opIds: ['op-1'] }

type OpEnvelope = Pick<Op, 'op_id' | 'actor' | 'base_version' | 'stamp'>
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never
type OpBody = DistributiveOmit<Op, keyof OpEnvelope>

function op(body: OpBody): Op {
  const envelope: OpEnvelope = {
    op_id: `op-${body.op}`.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test']
  }
  return { ...envelope, ...body }
}

function restoredAboveMaxDoc() {
  const local = new LGraph()
  const node = LiteGraph.createNode('DynamicGroupTest')
  assert.exists(node)
  local.add(node)
  node.configure({
    ...node.serialize(),
    widgets_values: ['head', 4, 0.1, 0.2, 0.3, 0.4, 'tail']
  })
  const snapshot = wireNodeSnapshot(node)
  assert.exists(snapshot)
  const catalog: WidgetCatalog = {
    types: {
      DynamicGroupTest: {
        widget_order: [
          'before',
          'rows',
          'rows.0.strength',
          'rows.1.strength',
          'rows.2.strength',
          'rows.3.strength',
          'after'
        ]
      }
    }
  }
  const { doc, collector } = followedDoc({ nodes: [], links: [] }, catalog)
  collector.take()
  const add = mintWireOps(
    [
      {
        op: 'add_node',
        node_id: node.id,
        class_type: snapshot.type,
        pos: [0, 0],
        node: snapshot
      }
    ],
    { actor: 'human:user:tab', baseVersion: 1 }
  )
  expect(
    applyOps(doc, add, catalog).outcomes.map(({ outcome }) => outcome)
  ).toEqual(['applied'])
  return { doc, collector, node }
}

async function workflowJson(graph: LGraph): Promise<ComfyWorkflowJSON> {
  const state = await validateComfyWorkflow(graph.serialize(), (error) => {
    throw new Error(error)
  })
  if (!state) throw new Error('graph did not serialize to a valid workflow')
  return JSON.parse(JSON.stringify(state)) as ComfyWorkflowJSON
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestSink', TestSink)
  LiteGraph.registerNodeType('DynamicGroupTest', DynamicGroupTest)
  LiteGraph.registerNodeType(
    'DynamicGroupOverflowTest',
    DynamicGroupOverflowTest
  )
  LiteGraph.registerNodeType(
    'DynamicGroupOverflowTrailingTest',
    DynamicGroupOverflowTrailingTest
  )
  DynamicGroupOverflowTest.nodeData = fromPartial<
    NonNullable<LGraphNode['constructor']['nodeData']>
  >({
    inputs: {
      mode: {
        type: 'COMFY_DYNAMICCOMBO_V3',
        name: 'mode',
        isOptional: false,
        options: []
      }
    }
  })
  ChangeTracker.isLoadingGraph = false
})

async function trackedCanvas(graph: LGraph, open: 'root' | 'subgraph') {
  appState.rootGraph = graph
  const element = document.createElement('canvas')
  element.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  const canvas = new LGraphCanvas(element, graph, {
    skip_render: true,
    skip_events: true
  })
  onTestFinished(() => {
    canvas.graph?.detachCanvas(canvas)
    appState.rootGraph = undefined
  })
  if (open === 'subgraph') {
    const subgraph = createTestSubgraph({ rootGraph: graph })
    const host = createTestSubgraphNode(subgraph, { id: 1000 })
    graph.add(host)
    canvas.openSubgraph(subgraph, host)
  }
  const beforeFrame = await workflowJson(graph)
  const tracker = markRaw(
    new ChangeTracker(fromPartial({ path: '/agent.json' }), beforeFrame)
  )
  const store = useWorkflowStore()
  const workflow = fromPartial<LoadedComfyWorkflow>({
    path: '/agent.json',
    changeTracker: tracker,
    isModified: false
  })
  store.attachWorkflow(workflow)
  store.activeWorkflow = workflow
  function trackChange(event: Event) {
    if (!(event instanceof CustomEvent)) return
    const detail: LGraphCanvasEventMap['litegraph:canvas'] = event.detail
    if (detail.subType === 'before-change') tracker.beforeChange()
    if (detail.subType === 'after-change') tracker.afterChange()
  }
  element.addEventListener('litegraph:canvas', trackChange)
  onTestFinished(() => {
    element.removeEventListener('litegraph:canvas', trackChange)
    store.activeWorkflow = null
  })
  const applier = new LiveGraphApplier({
    getGraph: () => graph,
    getCanvas: () => canvas
  })
  return { canvas, applier, tracker, workflow, beforeFrame }
}

describe('LiveGraphApplier with the real change tracker', () => {
  it.for([{ open: 'root' }, { open: 'subgraph' }] as const)(
    'records one undo entry and marks modified for a node-add frame with $open open',
    async ({ open }) => {
      const graph = new LGraph()
      const { applier, tracker, workflow, beforeFrame } = await trackedCanvas(
        graph,
        open
      )
      const { doc, collector } = followedDoc({ nodes: [], links: [] }, CATALOG)
      collector.take()
      const add = op({
        op: 'add_node',
        node_id: 42,
        class_type: 'TestSource',
        pos: [80, 120],
        node: { id: 42, type: 'TestSource', pos: [80, 120], size: [200, 100] }
      })

      expect(applyOps(doc, [add], CATALOG).outcomes[0].outcome).toBe('applied')
      applier.applyChanges(doc, collector.take(), CONTEXT)

      expect(graph.getNodeById(toNodeId(42))).not.toBeNull()
      expect.soft(tracker.undoQueue).toEqual([beforeFrame])
      expect(workflow.isModified).toBe(true)
    }
  )

  it('records one undo entry holding the pre-frame graph for a frame of several operations', async () => {
    const graph = new LGraph()
    appState.rootGraph = graph
    const { doc, collector } = followedDoc(
      {
        nodes: [
          {
            id: 1,
            type: 'TestSource',
            pos: [0, 0],
            size: [200, 100],
            outputs: [{ name: 'image', type: 'IMAGE', links: [] }],
            widgets_values: [20]
          }
        ],
        links: []
      },
      CATALOG
    )
    new LiveGraphApplier({ getGraph: () => graph }).applyChanges(
      doc,
      collector.take(),
      CONTEXT
    )
    const { applier, tracker, beforeFrame } = await trackedCanvas(
      graph,
      'subgraph'
    )

    const ops = [
      op({
        op: 'add_node',
        node_id: 2,
        class_type: 'TestSink',
        pos: [400, 0],
        node: {
          id: 2,
          type: 'TestSink',
          pos: [400, 0],
          size: [200, 100],
          inputs: [{ name: 'image', type: 'IMAGE', link: null }]
        }
      }),
      op({
        op: 'connect',
        link_id: 7,
        from_node: 1,
        from_slot: 0,
        to_node: 2,
        to_slot: 0,
        link_type: 'IMAGE'
      }),
      op({ op: 'set_widget', node_id: 1, widget: 'steps', value: 35 })
    ]
    expect(
      applyOps(doc, ops, CATALOG).outcomes.map(({ outcome }) => outcome)
    ).toEqual(['applied', 'applied', 'applied'])
    applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(graph.getNodeById(toNodeId(2))).not.toBeNull()
    expect(tracker.changeCount).toBe(0)
    expect(tracker.undoQueue).toEqual([beforeFrame])
    expect(tracker.activeState).toEqual(await workflowJson(graph))
    expect(tracker.activeState).not.toEqual(beforeFrame)
  })

  it('resizes an existing DynamicGroup remotely as one undo unit without outbound echo', async () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode('DynamicGroupTest')
    assert.exists(node)
    graph.add(node)
    const count = node.widgets?.find((widget) => widget.name === 'rows')
    assert.exists(count)
    count.value = 2
    const first = node.widgets?.find(
      (widget) => widget.name === 'rows.0.strength'
    )
    const second = node.widgets?.find(
      (widget) => widget.name === 'rows.1.strength'
    )
    assert.exists(first)
    assert.exists(second)
    first.value = 0.5
    second.value = 0.7
    expect(node.serialize().widgets_values).toEqual([
      'head',
      2,
      0.5,
      0.7,
      'tail'
    ])
    const { applier, tracker, beforeFrame } = await trackedCanvas(
      graph,
      'subgraph'
    )
    const { flags, ...serialized } = node.serialize()
    const { doc, collector } = followedDoc(
      { nodes: [{ ...serialized, flags: { ...flags } }], links: [] },
      CATALOG
    )
    collector.take()
    const enqueue = vi.fn()
    const minter = attachDocOpMinter({
      isEnabled: () => true,
      isDocBound: () => true,
      getGraph: () => graph,
      boundRootGraphId: () => toRootGraphId(graph.id),
      docInputNames: () => [],
      docWidgetValue: () => undefined,
      docPromotedWidgets: () => null,
      mayWritePromotedHost: () => true,
      docHasSubgraphDefinition: () => true,
      onWidgetWriteRefused: () => {},
      enqueue
    })
    onTestFinished(() => minter.detach())
    const resize = op({
      op: 'set_widget',
      node_id: 1,
      widget: 'rows',
      value: 0
    })
    const after = {
      ...op({
        op: 'set_widget',
        node_id: 1,
        widget: 'after',
        value: 'remote tail'
      }),
      op_id: 'op-after'.padEnd(32, '0')
    }

    expect(
      applyOps(doc, [resize, after], CATALOG).outcomes.map(
        ({ outcome }) => outcome
      )
    ).toEqual(['applied', 'applied'])
    applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(node.serialize().widgets_values).toEqual(['head', 0, 'remote tail'])
    expect(tracker.undoQueue).toEqual([beforeFrame])
    expect(tracker.activeState).toEqual(await workflowJson(graph))
    const afterWidget = node.widgets?.find((widget) => widget.name === 'after')
    assert.exists(afterWidget)
    afterWidget.value = 'human tail'
    await vi.waitFor(() =>
      expect(enqueue).toHaveBeenCalledExactlyOnceWith([
        {
          op: 'set_widget',
          node_id: '1',
          widget: 'after',
          value: 'human tail',
          old: 'remote tail'
        }
      ])
    )
  })

  it('creates a restored DynamicGroup holding more rows than its max on a follower', () => {
    const { doc, collector, node } = restoredAboveMaxDoc()
    const follower = new LGraph()
    const applier = new LiveGraphApplier({ getGraph: () => follower })

    const result = applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(result.failureCount).toBe(0)
    expect(follower.getNodeById(node.id)?.serialize().widgets_values).toEqual([
      'head',
      4,
      0.1,
      0.2,
      0.3,
      0.4,
      'tail'
    ])
  })

  it('creates a restored above-max DynamicGroup next to a stray positional key', () => {
    const { doc, collector, node } = restoredAboveMaxDoc()
    doc.transact(() => {
      const widgets = nodesMap(doc).get(String(node.id))?.get('widgets')
      assert.instanceOf(widgets, Y.Map)
      widgets.set('_extra_9', 1)
    })
    const follower = new LGraph()
    const applier = new LiveGraphApplier({ getGraph: () => follower })

    const result = applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(result.failureCount).toBe(1)
    expect(follower.getNodeById(node.id)?.serialize().widgets_values).toEqual([
      'head',
      4,
      0.1,
      0.2,
      0.3,
      0.4,
      'tail'
    ])
  })

  it('creates a DynamicGroup whose row count the document stores under a positional alias', () => {
    const { doc, collector } = followedDoc(
      {
        nodes: [
          {
            id: 1,
            type: 'DynamicGroupOverflowTest',
            pos: [0, 0],
            size: [210, 100],
            widgets_values: ['head', 2, 0.1, 0.2]
          }
        ],
        links: []
      },
      { types: { DynamicGroupOverflowTest: { widget_order: ['before'] } } }
    )
    const follower = new LGraph()
    const applier = new LiveGraphApplier({ getGraph: () => follower })

    const result = applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(result.failureCount).toBe(0)
    expect(
      follower.getNodeById(toNodeId(1))?.serialize().widgets_values
    ).toEqual(['head', 2, 0.1, 0.2])
  })

  it.for([
    { label: 'only the leading widget', widgetOrder: ['before'] },
    { label: 'the controller', widgetOrder: ['before', 'rows'] },
    { label: 'the trailing widget', widgetOrder: ['before', 'rows', 'after'] }
  ])(
    'restores aliased row values and the trailing widget on create when the catalog names $label',
    ({ widgetOrder }) => {
      const { doc, collector } = followedDoc(
        {
          nodes: [
            {
              id: 1,
              type: 'DynamicGroupOverflowTrailingTest',
              pos: [0, 0],
              size: [210, 100],
              widgets_values: ['head', 2, 0.1, 0.2, 'tail']
            }
          ],
          links: []
        },
        {
          types: {
            DynamicGroupOverflowTrailingTest: { widget_order: widgetOrder }
          }
        }
      )
      const follower = new LGraph()
      const applier = new LiveGraphApplier({ getGraph: () => follower })

      const result = applier.applyChanges(doc, collector.take(), CONTEXT)

      expect(result.failureCount).toBe(0)
      expect(
        follower.getNodeById(toNodeId(1))?.serialize().widgets_values
      ).toEqual(['head', 2, 0.1, 0.2, 'tail'])
    }
  )

  it('creates a restored above-max DynamicGroup on a node with a DynamicCombo (#21297)', () => {
    const { doc, collector } = followedDoc(
      {
        nodes: [
          {
            id: 1,
            type: 'DynamicGroupOverflowTest',
            pos: [0, 0],
            size: [210, 100],
            widgets_values: ['head', 4, 0.1, 0.2, 0.3, 0.4]
          }
        ],
        links: []
      },
      {
        types: {
          DynamicGroupOverflowTest: {
            widget_order: [
              'before',
              'rows',
              'rows.0.strength',
              'rows.1.strength',
              'rows.2.strength',
              'rows.3.strength'
            ]
          }
        }
      }
    )
    const follower = new LGraph()
    const applier = new LiveGraphApplier({ getGraph: () => follower })

    const result = applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(result.failureCount).toBe(0)
    expect(
      follower.getNodeById(toNodeId(1))?.serialize().widgets_values
    ).toEqual(['head', 4, 0.1, 0.2, 0.3, 0.4])
  })

  it('refuses a crafted DynamicGroup row count without row values on create', () => {
    const { doc, collector } = followedDoc(
      {
        nodes: [
          {
            id: 1,
            type: 'DynamicGroupTest',
            pos: [0, 0],
            size: [210, 100],
            widgets_values: ['head', 1e9, 'tail']
          }
        ],
        links: []
      },
      CATALOG
    )
    const follower = new LGraph()
    const applier = new LiveGraphApplier({ getGraph: () => follower })

    const result = applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(result.failureCount).toBe(1)
    expect(
      follower.getNodeById(toNodeId(1))?.serialize().widgets_values
    ).toEqual(['head', 0, 'tail'])
  })

  it('aborts an over-bound positional restore before trailing values shift', () => {
    const { doc, collector } = followedDoc(
      {
        nodes: [
          {
            id: 1,
            type: 'DynamicGroupTest',
            pos: [0, 0],
            size: [210, 100],
            widgets_values: [
              'remote head',
              MAX_DYNAMIC_GROUP_ROWS + 1,
              'attacker tail'
            ]
          }
        ],
        links: []
      },
      { types: {} }
    )
    const follower = new LGraph()
    const applier = new LiveGraphApplier({ getGraph: () => follower })

    const result = applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(result.failureCount).toBe(1)
    expect(
      follower.getNodeById(toNodeId(1))?.serialize().widgets_values
    ).toEqual(['remote head', 0, 'tail'])
  })

  it('builds a DynamicGroup node from the catch-up frame without outbound echo and reloads to the same graph', async () => {
    const graph = new LGraph()
    appState.rootGraph = graph
    onTestFinished(() => {
      appState.rootGraph = undefined
    })
    const { doc, collector } = followedDoc(
      {
        nodes: [
          {
            id: 1,
            type: 'DynamicGroupTest',
            pos: [0, 0],
            size: [200, 100],
            widgets_values: ['head', 2, 0.5, 0.7, 'tail']
          }
        ],
        links: []
      },
      CATALOG
    )
    const enqueue = vi.fn()
    const minter = attachDocOpMinter({
      isEnabled: () => true,
      isDocBound: () => true,
      getGraph: () => graph,
      boundRootGraphId: () => toRootGraphId(graph.id),
      docInputNames: () => [],
      docWidgetValue: () => undefined,
      docPromotedWidgets: () => null,
      mayWritePromotedHost: () => true,
      docHasSubgraphDefinition: () => true,
      onWidgetWriteRefused: () => {},
      enqueue
    })
    onTestFinished(() => minter.detach())
    const applier = new LiveGraphApplier({ getGraph: () => graph })

    applier.applyChanges(doc, collector.take(), CONTEXT)

    const node = graph.getNodeById(toNodeId(1))
    assert.exists(node)
    expect(node.serialize().widgets_values).toEqual([
      'head',
      2,
      0.5,
      0.7,
      'tail'
    ])
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    expect(enqueue).not.toHaveBeenCalled()

    const saved = await workflowJson(graph)
    const reloaded = new LGraph()
    reloaded.configure(structuredClone(graph.serialize()))
    expect(await workflowJson(reloaded)).toEqual({
      ...saved,
      id: expect.any(String)
    })
  })
})
