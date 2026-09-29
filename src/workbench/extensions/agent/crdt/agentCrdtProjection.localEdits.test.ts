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
import { toNodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'

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
 * bind again over the same doc, apply anything collected meanwhile, and
 * deliver the host's catch-up for the follower's state vector.
 */
function bindFollower(graph: LGraph, saved: ISerialisedGraph) {
  const host = mint(toWorkflowJson(saved), CATALOG)
  const follower = new FollowerDoc()
  let liveGraph: LGraph | null = graph
  const projection = new AgentCrdtProjection(() => liveGraph)
  let seq = 0
  const deliver = (update: Uint8Array, applied = true): void => {
    follower.applyRemoteUpdate(update)
    expect(
      projection.applyFrame({
        workflowId: WORKFLOW_ID,
        seq: ++seq,
        update,
        actor: 'agent:comfy:host',
        opIds: []
      })
    ).toMatchObject({ applied })
  }
  projection.bind(WORKFLOW_ID, follower)
  deliver(Y.encodeStateAsUpdate(host))

  /** The host applies the ops and echoes the delta, as the relay fans it out. */
  const hostApplies = (ops: Op[], applied = true): void => {
    const before = Y.encodeStateVector(host)
    const { outcomes } = applyOps(host, ops, CATALOG)
    expect(outcomes.map((outcome) => outcome.outcome)).toEqual(['applied'])
    deliver(Y.encodeStateAsUpdate(host, before), applied)
  }
  /** The host refuses the ops; the projection reverts what they claimed. */
  const hostRejects = (ops: Op[]) => {
    projection.settleLocalWrites(ops)
    return projection.revertRejected(WORKFLOW_ID, ops)
  }
  /**
   * The host applies this tab's own ops and echoes them; the follower drops
   * the echo, as `useAgentCrdtFollower` does for its own actor.
   */
  const hostEchoes = (ops: Op[]): void => {
    const before = Y.encodeStateVector(host)
    const { outcomes } = applyOps(host, ops, CATALOG)
    expect(outcomes.map((outcome) => outcome.outcome)).toEqual(['applied'])
    follower.applyRemoteUpdate(Y.encodeStateAsUpdate(host, before))
    projection.discardPending(WORKFLOW_ID)
  }
  const tabReturn = (): void => {
    projection.bind(WORKFLOW_ID, follower)
    projection.applyCollected(WORKFLOW_ID)
    deliver(Y.encodeStateAsUpdate(host, follower.stateVector()))
  }
  const withoutGraph = (fn: () => void): void => {
    liveGraph = null
    fn()
    liveGraph = graph
  }
  const destroy = () => {
    projection.destroy()
    follower.destroy()
    host.destroy()
  }
  return {
    projection,
    hostApplies,
    hostEchoes,
    hostRejects,
    tabReturn,
    withoutGraph,
    destroy
  }
}

let stampClock = 1

/** Each op carries a later stamp than the last, as a live host hands them out. */
function setStepsOp(node: LGraphNode, value: number, actor = HUMAN_ACTOR): Op {
  return {
    op: 'set_widget',
    op_id: `${actor}-set-steps-${value}`,
    actor,
    base_version: 1,
    stamp: [++stampClock, actor],
    node_id: node.id,
    widget: 'steps',
    value
  }
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
  it('keeps a node the user added whose add_node has not reached the doc', () => {
    const { graph, source } = buildLiveGraph()
    const saved = structuredClone(graph.serialize())
    const added = createRegisteredNode('TestSource')
    graph.add(added)
    added.pos = [300, 20]
    const { tabReturn, destroy } = bindFollower(graph, saved)
    expect(nodeIds(graph).live).toEqual([String(source.id), String(added.id)])

    tabReturn()

    const expected = [String(source.id), String(added.id)]
    expect(nodeIds(graph)).toEqual({
      live: expected,
      records: expected,
      serialized: expected
    })
    destroy()
  })

  it('applies a frame delivered while no graph could take it once one is back', () => {
    const { graph, source } = buildLiveGraph()
    const { hostApplies, withoutGraph, tabReturn, destroy } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    const agentNode = createRegisteredNode('TestSource')
    agentNode.id = toNodeId(77)

    withoutGraph(() => hostApplies([addNodeOp(agentNode, [20])], false))
    expect(nodeIds(graph).live).toEqual([String(source.id)])

    tabReturn()

    expect(nodeIds(graph).live).toEqual([String(source.id), '77'])
    destroy()
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

describe('AgentCrdtProjection after the host rejects a human batch', () => {
  it('removes the node whose add_node was refused and nothing else', () => {
    const { graph, source } = buildLiveGraph()
    const { hostRejects, destroy } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    const refused = createRegisteredNode('TestSource')
    graph.add(refused)
    const kept = createRegisteredNode('TestNote')
    graph.add(kept)

    expect(hostRejects([addNodeOp(refused, [20])])).toEqual([])

    expect(nodeIds(graph).live).toEqual([String(source.id), String(kept.id)])
    destroy()
  })

  it('restores the node whose delete_node was refused with its document widgets', () => {
    const { graph, source } = buildLiveGraph()
    source.widgets![0].value = 55
    const { hostRejects, destroy } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    graph.remove(source)
    expect(nodeIds(graph).live).toEqual([])

    expect(
      hostRejects([
        {
          op: 'delete_node',
          op_id: 'human-delete',
          actor: HUMAN_ACTOR,
          base_version: 1,
          stamp: [1, HUMAN_ACTOR],
          node_id: source.id,
          removed_links: []
        }
      ])
    ).toEqual([source.id])

    expect(nodeIds(graph).live).toEqual([String(source.id)])
    expect(graph.getNodeById(source.id)?.widgets?.[0]?.value).toBe(55)
    destroy()
  })

  it('puts back only the widget whose set_widget was refused', () => {
    const { graph, source } = buildLiveGraph()
    const { hostRejects, destroy } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    const other = createRegisteredNode('TestSource')
    graph.add(other)
    source.widgets![0].value = 99
    other.widgets![0].value = 99

    hostRejects([
      {
        op: 'set_widget',
        op_id: 'human-set-steps',
        actor: HUMAN_ACTOR,
        base_version: 1,
        stamp: [1, HUMAN_ACTOR],
        node_id: source.id,
        widget: 'steps',
        value: 99
      }
    ])

    expect(source.widgets![0].value).toBe(20)
    expect(other.widgets![0].value).toBe(99)
    destroy()
  })
})

describe('AgentCrdtProjection with a local widget write in flight', () => {
  const AGENT_ACTOR = 'agent:comfy'

  it('holds a remote value for the register until the document holds the local write', () => {
    const { graph, source } = buildLiveGraph()
    const { projection, hostApplies, hostEchoes, destroy } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    const steps = source.widgets![0]

    steps.value = 25
    projection.noteLocalWrites([setStepsOp(source, 25)])
    hostApplies([setStepsOp(source, 40, AGENT_ACTOR)])
    expect(steps.value).toBe(25)

    hostEchoes([setStepsOp(source, 25)])
    hostApplies([setStepsOp(source, 60, AGENT_ACTOR)])
    expect(steps.value).toBe(60)
    destroy()
  })

  it('keeps holding while a newer local write is still out after an older one is echoed', () => {
    const { graph, source } = buildLiveGraph()
    const { projection, hostApplies, hostEchoes, destroy } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    const steps = source.widgets![0]

    steps.value = 25
    projection.noteLocalWrites([setStepsOp(source, 25)])
    steps.value = 30
    projection.noteLocalWrites([setStepsOp(source, 30)])
    hostEchoes([setStepsOp(source, 25)])
    hostApplies([setStepsOp(source, 40, AGENT_ACTOR)])
    expect(steps.value).toBe(30)

    hostEchoes([setStepsOp(source, 30)])
    hostApplies([setStepsOp(source, 60, AGENT_ACTOR)])
    expect(steps.value).toBe(60)
    destroy()
  })

  it('lets a remote value through once the host has refused the local write', () => {
    const { graph, source } = buildLiveGraph()
    const { projection, hostApplies, hostRejects, destroy } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )
    const steps = source.widgets![0]

    steps.value = 25
    projection.noteLocalWrites([setStepsOp(source, 25)])
    hostRejects([setStepsOp(source, 25)])
    expect(steps.value).toBe(20)

    hostApplies([setStepsOp(source, 40, AGENT_ACTOR)])
    expect(steps.value).toBe(40)
    destroy()
  })

  it('does not hold registers without a local write in flight', () => {
    const { graph, source } = buildLiveGraph()
    const other = createRegisteredNode('TestSource')
    graph.add(other)
    const { projection, hostApplies, destroy } = bindFollower(
      graph,
      structuredClone(graph.serialize())
    )

    source.widgets![0].value = 25
    projection.noteLocalWrites([setStepsOp(source, 25)])
    hostApplies([setStepsOp(other, 40, AGENT_ACTOR)])
    expect(other.widgets![0].value).toBe(40)
    expect(source.widgets![0].value).toBe(25)
    destroy()
  })
})
