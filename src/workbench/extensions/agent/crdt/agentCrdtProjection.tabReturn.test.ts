import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'
import { NO_PENDING_LOCAL_EDITS } from './pendingLocalEdits'

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

const WORKFLOW_ID = 'wf-a'
const HUMAN_ACTOR = 'human:user:tab'
const CATALOG: WidgetCatalog = {
  types: { TestSource: { widget_order: ['steps'] } }
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
 * unbind, bind again over the same doc, sync the live graph from the whole
 * doc, and deliver the host's catch-up for the follower's state vector.
 */
function bindFollower(
  graph: LGraph,
  saved: ISerialisedGraph,
  pendingAddedNodeIds: ReadonlySet<string> = new Set()
) {
  const host = mint(toWorkflowJson(saved), CATALOG)
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph, undefined, {
    pendingEdits: () => ({
      ...NO_PENDING_LOCAL_EDITS,
      addedNodeIds: pendingAddedNodeIds
    })
  })
  let seq = 0
  const deliver = (update: Uint8Array): void => {
    follower.applyRemoteUpdate(update)
    expect(
      projection.applyFrame({
        workflowId: WORKFLOW_ID,
        seq: ++seq,
        update,
        actor: 'agent:comfy:host',
        opIds: []
      })
    ).toMatchObject({ applied: true })
  }
  projection.bind(WORKFLOW_ID, follower)
  deliver(Y.encodeStateAsUpdate(host))

  /** The host applies the ops and echoes the delta, as the relay fans it out. */
  const hostApplies = (ops: Op[]): void => {
    const before = Y.encodeStateVector(host)
    const { outcomes } = applyOps(host, ops, CATALOG)
    expect(outcomes.map((outcome) => outcome.outcome)).toEqual(['applied'])
    deliver(Y.encodeStateAsUpdate(host, before))
  }
  const tabReturn = (): void => {
    projection.unbind(WORKFLOW_ID)
    projection.bind(WORKFLOW_ID, follower)
    projection.syncFromDoc(WORKFLOW_ID)
    deliver(Y.encodeStateAsUpdate(host, follower.stateVector()))
  }
  const destroy = () => {
    projection.destroy()
    follower.destroy()
    host.destroy()
  }
  return { hostApplies, tabReturn, destroy }
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

beforeEach(() => {
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestNote', TestNote)
})

describe('AgentCrdtProjection after a tab return', () => {
  it.for([
    { name: 'keeps', pending: true },
    { name: 'removes', pending: false }
  ])(
    '$name a node the user added whose add_node has not reached the doc when the add is $pending',
    ({ pending }) => {
      const { graph, source } = buildLiveGraph()
      const saved = structuredClone(graph.serialize())
      const added = createRegisteredNode('TestSource')
      graph.add(added)
      added.pos = [300, 20]
      const { tabReturn, destroy } = bindFollower(
        graph,
        saved,
        pending ? new Set([String(added.id)]) : new Set()
      )
      expect(nodeIds(graph).live).toEqual([String(source.id), String(added.id)])

      tabReturn()

      const expected = pending
        ? [String(source.id), String(added.id)]
        : [String(source.id)]
      expect(nodeIds(graph)).toEqual({
        live: expected,
        records: expected,
        serialized: expected
      })
      destroy()
    }
  )

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
      const { hostApplies, tabReturn, destroy } = bindFollower(
        graph,
        structuredClone(graph.serialize())
      )
      const added = createRegisteredNode(type)
      graph.add(added)
      added.pos = [300, 20]
      hostApplies([addNodeOp(added, widgetsValues)])

      tabReturn()

      expect(nodeIds(graph)).toEqual({
        live: [String(source.id), String(added.id)],
        records: [String(source.id), String(added.id)],
        serialized: [String(source.id), String(added.id)]
      })
      destroy()
    }
  )

  it('keeps a node the doc never took when a later accepted add is echoed, without any tab return', () => {
    const { graph, source } = buildLiveGraph()
    const { hostApplies, destroy } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    const rejectedByHost = createRegisteredNode('TestNote')
    graph.add(rejectedByHost)
    const accepted = createRegisteredNode('TestSource')
    graph.add(accepted)
    hostApplies([addNodeOp(accepted, [20])])

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
    hostApplies([setWidget])

    expect(nodeIds(graph).live).toEqual([
      source.id,
      rejectedByHost.id,
      accepted.id
    ])
    destroy()
  })
})
