import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import type { LLink } from '@/lib/litegraph/src/LLink'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'
import { createPendingOpTracker } from './pendingOpTracker'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

class TestSource extends LGraphNode {
  static override title = 'Test Source'
  constructor() {
    super('Test Source')
    this.addWidget('number', 'steps', 20, () => {}, { min: 1, max: 100 })
    this.addOutput('image', 'IMAGE')
    this.serialize_widgets = true
  }
}

// Registered by the frontend only, absent from the catalog: the footing a
// Get/Set node from a custom-node pack stands on.
class TestNote extends LGraphNode {
  static override title = 'Note'
  constructor() {
    super('Note')
    this.addWidget('markdown', 'text', '', () => {}, { multiline: true })
    this.serialize_widgets = true
  }
}

// An input-bearing sink, so a `connect` from `TestSource`'s output has
// somewhere real to land (C6 regression: add-plus-connect tab return).
class TestSink extends LGraphNode {
  static override title = 'Test Sink'
  constructor() {
    super('Test Sink')
    this.addInput('image', 'IMAGE')
  }
}

const WORKFLOW_ID = 'wf-a'
const HUMAN_ACTOR = 'human:user:tab'
const CATALOG: WidgetCatalog = {
  types: { TestSource: { widget_order: ['steps'] } }
}
const layout = { createNode: vi.fn(), deleteNodes: vi.fn() }

function remoteMutations(scope: GraphScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout,
    placement: inertPlacementPort
  })
}

function toWorkflowJson({ nodes, ...rest }: ISerialisedGraph): WorkflowJSON {
  return {
    ...rest,
    nodes: nodes.map(({ flags, ...node }) => ({ ...node, flags: { ...flags } }))
  }
}

function createRegisteredNode(type: string): LGraphNode {
  const node = LiteGraph.createNode(type)
  if (!node) throw new Error(`${type} not registered`)
  return node
}

/** The saved workflow the Agent bound to, as the user left it. */
function buildLiveGraph() {
  const graph = new LGraph()
  const source = createRegisteredNode('TestSource')
  graph.add(source)
  source.pos = [10, 20]
  return { graph, source }
}

function nodeIds(graph: LGraph) {
  const scope = graphScopeOf(graph)
  return {
    live: graph._nodes.map((node) => String(node.id)),
    records: useNodeDataStore()
      .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
      .map((state) => String(state.id)),
    serialized: graph.serialize().nodes.map((node) => String(node.id))
  }
}

/**
 * A follower bound to the doc minted from the graph's own save. `tabReturn`
 * does what leaving the workflow tab and coming back does to the follower:
 * unbind, bind a fresh session over the same doc, and deliver the host's
 * catch-up for the follower's state vector.
 */
function bindFollower(graph: LGraph, saved: ISerialisedGraph) {
  const host = mint(toWorkflowJson(saved), CATALOG)
  const follower = new FollowerDoc()
  onTestFinished(() => {
    follower.destroy()
    host.destroy()
  })
  const pendingOps = createPendingOpTracker()
  const projection = new AgentCrdtProjection(
    remoteMutations(graphScopeOf(graph)),
    () => graph,
    () => follower.doc,
    (id) => pendingOps.pendingAddType(id),
    {
      pendingDeletes: () => new Set(),
      pendingAdds: () => pendingOps.pendingAddNodeIds(),
      pendingConnects: () => pendingOps.pendingConnectLinkIds()
    }
  )
  onTestFinished(() => projection.destroy())
  let seq = 0
  /** Delivers one host frame; returns whether the adapter committed it. */
  const deliver = (update: Uint8Array): boolean => {
    follower.applyRemoteUpdate(update)
    const committed = projection.applyFrame({
      workflowId: WORKFLOW_ID,
      seq: ++seq,
      update,
      actor: 'agent:comfy:host',
      opIds: []
    })
    projection.reconcileLiveGraph(WORKFLOW_ID)
    return committed
  }
  projection.bind(WORKFLOW_ID, follower)
  expect(deliver(Y.encodeStateAsUpdate(host))).toBe(true)

  /** The host applies the ops and echoes the delta, as the relay fans it out. */
  const hostApplies = (ops: Op[]): boolean => {
    pendingOps.onBatchMinted(ops)
    pendingOps.onBatchTransmitted(ops)
    const before = Y.encodeStateVector(host)
    const { outcomes } = applyOps(host, ops, CATALOG)
    expect(outcomes.map((outcome) => outcome.outcome)).toEqual(['applied'])
    return deliver(Y.encodeStateAsUpdate(host, before))
  }
  const tabReturn = (): boolean => {
    projection.unbind(WORKFLOW_ID)
    projection.bind(WORKFLOW_ID, follower)
    return deliver(Y.encodeStateAsUpdate(host, follower.stateVector()))
  }
  /**
   * Registers a human op as pending in one of the two states a batch can sit
   * in before any result comes back — `queued` (minted, never even handed
   * to the transport) or `inflight` (also transmitted) — so
   * `pendingAddNodeIds()`/`pendingConnectLinkIds()` still report it in
   * EITHER state, not only the transmitted one.
   */
  const registerPendingOps = (
    ops: Op[],
    state: 'queued' | 'inflight' = 'inflight'
  ): void => {
    pendingOps.onBatchMinted(ops)
    if (state === 'inflight') pendingOps.onBatchTransmitted(ops)
  }
  return { hostApplies, tabReturn, registerPendingOps }
}

function addNodeOp(node: LGraphNode, widgetsValues: unknown[]): Op {
  const opId = `human-add-${String(node.id)}`
  return {
    op: 'add_node',
    op_id: opId,
    actor: HUMAN_ACTOR,
    base_version: 1,
    stamp: [1, HUMAN_ACTOR],
    node_id: node.id,
    class_type: node.type,
    pos: [node.pos[0], node.pos[1]],
    node: {
      id: node.id,
      type: node.type,
      pos: [node.pos[0], node.pos[1]],
      size: [node.size[0], node.size[1]],
      inputs: [],
      outputs: [],
      widgets_values: widgetsValues
    }
  }
}

function connectOp(link: LLink): Op {
  return {
    op: 'connect',
    op_id: `human-connect-${link.id}`,
    actor: HUMAN_ACTOR,
    base_version: 1,
    stamp: [1, HUMAN_ACTOR],
    link_id: link.id,
    from_node: link.origin_id,
    from_slot: link.origin_slot,
    to_node: link.target_id,
    to_slot: link.target_slot,
    link_type: String(link.type)
  }
}

beforeEach(() => {
  layout.createNode.mockReset()
  layout.deleteNodes.mockReset()
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestNote', TestNote)
  LiteGraph.registerNodeType('TestSink', TestSink)
})

describe('AgentCrdtProjection after a tab return', () => {
  // The first frame after a rebind runs a full reconcile whose removeMissing
  // would otherwise delete every store record the doc does not hold; a
  // node whose `add_node` is still queued/in-flight is exempted via
  // `LocalIntent.pendingAdds` (ADR-CRDT-RECONCILE-0035).
  it.for(['queued', 'inflight'] as const)(
    'keeps a node the user added whose add_node never reached the doc (%s)',
    (state) => {
      const { graph, source } = buildLiveGraph()
      const { tabReturn, registerPendingOps } = bindFollower(
        graph,
        structuredClone(graph.serialize())
      )
      const added = createRegisteredNode('TestSource')
      graph.add(added)
      added.pos = [300, 20]
      registerPendingOps([addNodeOp(added, [20])], state)
      expect(nodeIds(graph).live).toEqual([String(source.id), String(added.id)])

      tabReturn()

      expect(nodeIds(graph)).toEqual({
        live: [String(source.id), String(added.id)],
        records: [String(source.id), String(added.id)],
        serialized: [String(source.id), String(added.id)]
      })
      expect(layout.deleteNodes).not.toHaveBeenCalled()
    }
  )

  // C6 regression: an add-plus-connect made just before the tab switch must
  // return with BOTH halves intact. Before this fix `removeMissing` only
  // exempted the pending node id (`LocalIntent.pendingAdds`); the pending
  // `connect`'s link id was not exempted, so `removeMissing` dropped the
  // optimistic edge even though the node it wired survived.
  it('keeps a node and its edge when both the add_node and the connect never reached the doc', () => {
    const { graph, source } = buildLiveGraph()
    const { tabReturn, registerPendingOps } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    const added = createRegisteredNode('TestSink')
    graph.add(added)
    added.pos = [300, 20]
    const link = source.connect(0, added, 0)
    if (!link) throw new Error('expected the optimistic connect to succeed')
    registerPendingOps([addNodeOp(added, []), connectOp(link)])

    tabReturn()

    expect(nodeIds(graph).live).toEqual([String(source.id), String(added.id)])
    expect(added.getInputLink(0)?.id).toBe(link.id)
    expect(layout.deleteNodes).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'a catalogued node',
      type: 'TestSource',
      widgetsValues: [20]
    },
    {
      name: 'a frontend-only node the catalog does not describe',
      type: 'TestNote',
      widgetsValues: ['']
    }
  ])(
    'keeps $name the user added once its add_node landed in the doc',
    ({ type, widgetsValues }) => {
      const { graph, source } = buildLiveGraph()
      const { hostApplies, tabReturn } = bindFollower(
        graph,
        structuredClone(graph.serialize())
      )
      const added = createRegisteredNode(type)
      graph.add(added)
      added.pos = [300, 20]
      expect(hostApplies([addNodeOp(added, widgetsValues)])).toBe(true)

      tabReturn()

      expect(nodeIds(graph)).toEqual({
        live: [String(source.id), String(added.id)],
        records: [String(source.id), String(added.id)],
        serialized: [String(source.id), String(added.id)]
      })
      expect(layout.deleteNodes).not.toHaveBeenCalled()
    }
  )

  it('keeps a node the doc never took when a later accepted add is echoed, without any tab return', () => {
    const { graph, source } = buildLiveGraph()
    const { hostApplies } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    const rejectedByHost = createRegisteredNode('TestNote')
    graph.add(rejectedByHost)
    const accepted = createRegisteredNode('TestSource')
    graph.add(accepted)
    expect(hostApplies([addNodeOp(accepted, [20])])).toBe(true)

    const setWidget: Op = {
      op: 'set_widget',
      op_id: 'human-set-steps',
      actor: HUMAN_ACTOR,
      base_version: 2,
      stamp: [2, HUMAN_ACTOR],
      node_id: accepted.id,
      widget: 'steps',
      value: 30
    }
    expect(hostApplies([setWidget])).toBe(true)

    expect(nodeIds(graph)).toEqual({
      live: [source.id, rejectedByHost.id, accepted.id],
      records: [source.id, rejectedByHost.id, accepted.id],
      serialized: [source.id, rejectedByHost.id, accepted.id]
    })
    expect(layout.deleteNodes).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })
})
