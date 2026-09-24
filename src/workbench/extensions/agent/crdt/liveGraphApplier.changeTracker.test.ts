import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { markRaw, ref } from 'vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyApi } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { toNodeId } from '@/types/nodeId'

import { DocChangeCollector } from './docChangeCollector'
import { LiveGraphApplier } from './liveGraphApplier'

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
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

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

const CATALOG: WidgetCatalog = {
  types: {
    TestSource: { widget_order: ['steps'] },
    TestSink: { widget_order: [] }
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
  ChangeTracker.isLoadingGraph = false
})

describe('LiveGraphApplier with the real change tracker', () => {
  it('records one undo entry holding the pre-frame graph for a frame of several operations', async () => {
    const graph = new LGraph()
    appState.rootGraph = graph
    const doc = mint(
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
    const collector = new DocChangeCollector(doc)
    const applier = new LiveGraphApplier({ getGraph: () => graph })
    onTestFinished(() => {
      collector.destroy()
      doc.destroy()
      appState.rootGraph = undefined
    })
    applier.syncFromDoc(doc, CONTEXT)
    collector.take()

    const beforeFrame = await workflowJson(graph)
    const tracker = markRaw(
      new ChangeTracker(fromPartial({ path: '/agent.json' }), beforeFrame)
    )
    useWorkflowStore().activeWorkflow = fromPartial({ changeTracker: tracker })
    graph.list_of_graphcanvas = [
      fromPartial<LGraphCanvas>({
        emitBeforeChange: () => tracker.beforeChange(),
        emitAfterChange: () => tracker.afterChange(),
        setDirty: () => {},
        deselect: () => {},
        checkPanels: () => {}
      })
    ]

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
})
