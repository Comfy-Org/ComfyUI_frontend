import { applyOps } from '@comfyorg/comfy-multi-player'
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

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { LGraphCanvasEventMap } from '@/lib/litegraph/src/infrastructure/LGraphCanvasEventMap'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyApi } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { toNodeId } from '@/types/nodeId'
import { toRootGraphId } from '@/types/graphScopeId'
import { useLitegraphService } from '@/services/litegraphService'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'
import { attachDocOpMinter } from './docOpMinter'

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
vi.mock(import('@/scripts/api'), () => ({
  api: fromPartial<ComfyApi>({
    dispatchCustomEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
}))
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
      const { canvas, applier, tracker, workflow, beforeFrame } =
        await trackedCanvas(graph, open)
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
      canvas.dirty_canvas = false
      canvas.dirty_bgcanvas = false
      applier.applyChanges(doc, collector.take(), CONTEXT)

      expect(graph.getNodeById(toNodeId(42))).not.toBeNull()
      expect.soft(tracker.undoQueue).toEqual([beforeFrame])
      expect(workflow.isModified).toBe(true)
      expect(canvas.dirty_canvas).toBe(true)
      expect(canvas.dirty_bgcanvas).toBe(true)
    }
  )

  it('records one undo entry holding the pre-frame graph for a frame of several operations', async () => {
    const graph = new LGraph()
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

  it.for([{ open: 'root' }, { open: 'subgraph' }] as const)(
    'resizes an existing DynamicGroup remotely as one undo unit without outbound echo with $open open',
    async ({ open }) => {
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
      const { applier, tracker, beforeFrame } = await trackedCanvas(graph, open)
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
        docPromotedWidgets: () => null,
        mayWritePromotedHost: () => true,
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

      expect(node.serialize().widgets_values).toEqual([
        'head',
        0,
        'remote tail'
      ])
      expect(tracker.undoQueue).toEqual([beforeFrame])
      expect(tracker.activeState).toEqual(await workflowJson(graph))
      const afterWidget = node.widgets?.find(
        (widget) => widget.name === 'after'
      )
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
    }
  )
})
