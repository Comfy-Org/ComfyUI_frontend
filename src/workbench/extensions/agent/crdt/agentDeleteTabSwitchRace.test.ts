/**
 * Deleting an agent-added node must persist across a workflow tab switch.
 * Two behaviors combine:
 *
 * - `opSender.ts` binds a batch to the workflow id at ENQUEUE time and
 *   re-checks that binding when the batch is transmitted. A tab switch pauses
 *   the subscription (send reality goes null) without rebinding the session,
 *   so a delete queued behind an in-flight batch is held while the sender is
 *   suspended and sent to the same workflow on return, instead of settling
 *   `undeliverable` and never reaching the server.
 * - Locally, deleting a node removes it from the canvas and the node store
 *   immediately (`LGraph.remove()` -> `nodeDataStore.deleteNode()`), but never
 *   touches the follower's Y.Doc, which mirrors the SERVER's state.
 * - A tab (re)activation keeps the projection bound and applies only what
 *   the doc collected meanwhile, so a node whose human delete is still
 *   pending is not recreated from the doc before the delete's effect lands.
 *
 * This test drives the real `opSender`, `AgentCrdtProjection` and
 * `FollowerDoc`, forcing the suspend and the resubscribe deterministically
 * instead of relying on timing.
 */
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'
import { mintWireOps } from './opEnvelope'
import type { BatchOutcome, OpsResultView } from './opSender'
import { createOpSender } from './opSender'

class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
  }
}

const WORKFLOW = 'wf-a'
const CATALOG: WidgetCatalog = { types: { dummy: { widget_order: [] } } }

function addNodePayload(id: number): GraphOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'dummy',
    pos: [0, 0],
    node: {
      id,
      type: 'dummy',
      pos: [0, 0],
      size: [100, 80],
      inputs: [],
      outputs: []
    }
  }
}

function deleteNodeOp(nodeId: number): GraphOperation {
  return { op: 'delete_node', node_id: nodeId, removed_links: [] }
}

beforeEach(() => {
  LiteGraph.registerNodeType('dummy', DummyNode)
})

/**
 * Drives the race up to the point where the user returns to the tab: the
 * agent added node 1, the user deleted it locally, the delete queued behind
 * an in-flight batch, the tab went inactive (sender suspended, send reality
 * null) and the in-flight batch settled while away. Returns the handles the
 * two cases need to finish the story differently.
 */
function setupRaceUntilReturn() {
  const graph = new LGraph()
  // `host` stands in for the server's canonical Yjs document.
  const host = mint({ nodes: [], links: [] }, CATALOG)
  const follower = new FollowerDoc()

  let boundWorkflow: string | null = WORKFLOW
  let frameSeq = 0
  const sent: Array<{ workflowId: string; ops: Op[] }> = []
  const settled: BatchOutcome[] = []
  const listenerBox: {
    resultListener: ((result: OpsResultView) => void) | null
  } = { resultListener: null }
  const sender = createOpSender({
    sendOps: (workflowId, _tab, ops) => {
      sent.push({ workflowId, ops })
      return true
    },
    onOpsResult: (listener) => {
      listenerBox.resultListener = listener
      return () => {
        listenerBox.resultListener = null
      }
    },
    workflowId: () => boundWorkflow,
    tab: 'tab-1',
    actor: () => 'human:test-user:tab-1',
    baseVersion: () => frameSeq,
    onBatchSettled: (outcome) => settled.push(outcome)
  })
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind(WORKFLOW, follower)

  let opSequence = 0
  let sentInitialFrame = false
  const applyToHost = (ops: Op[]) => {
    const result = applyOps(host, ops, CATALOG)
    expect(result.outcomes.map(({ outcome }) => outcome)).toEqual(
      ops.map(() => 'applied')
    )
  }
  const deliverFromHost = (payload?: GraphOperation) => {
    const stateVector = Y.encodeStateVector(host)
    let opId: string | undefined
    if (payload) {
      const ops = mintWireOps([payload], {
        actor: 'agent:test',
        baseVersion: ++opSequence
      })
      opId = ops[0].op_id
      applyToHost(ops)
    }
    const update = sentInitialFrame
      ? Y.encodeStateAsUpdate(host, stateVector)
      : Y.encodeStateAsUpdate(host)
    sentInitialFrame = true
    follower.applyRemoteUpdate(update)
    projection.applyFrame({
      workflowId: WORKFLOW,
      seq: ++frameSeq,
      update,
      actor: 'agent:test',
      opIds: opId ? [opId] : []
    })
  }
  const acknowledge = (ops: Op[]) => {
    listenerBox.resultListener?.({
      ok: true,
      applied: ops.map((op) => op.op_id),
      skipped: []
    })
  }

  // The agent adds an unrelated node: this is the very first frame, so it
  // lands through the initial full sync.
  deliverFromHost(addNodePayload(1))
  expect(graph.getNodeById(toNodeId(1))).toBeTruthy()

  // An earlier, unrelated edit is already in flight...
  sender.enqueue([{ op: 'set_widget', node_id: 2, widget: 'x', value: 1 }])
  expect(sent).toHaveLength(1)

  // ...so the human's delete of the unwanted node queues up behind it.
  sender.enqueue([deleteNodeOp(1)])
  expect(sent).toHaveLength(1)

  // The user deletes the node on the canvas right away: gone from the live
  // graph, but the server never heard about it.
  const node = graph.getNodeById(toNodeId(1))!
  graph.remove(node)
  expect(graph.getNodeById(toNodeId(1))).toBeNull()

  // The user switches to another workflow tab: the follower suspends the
  // sender and unsubscribes, so send reality is null.
  sender.suspend()
  boundWorkflow = null

  // The in-flight batch settles while away; the queued delete is held, not
  // dropped.
  acknowledge(sent[0].ops)
  expect(sent).toHaveLength(1)
  expect(settled.map((outcome) => outcome.state)).toEqual(['acknowledged'])
  expect(sender.pending()).toBe(1)

  // The user returns: the follower binds the same follower again, applies
  // what was collected meanwhile, resubscribes, runs the eager abort check
  // and resumes the sender. The held delete goes out to the same workflow.
  boundWorkflow = WORKFLOW
  projection.bind(WORKFLOW, follower)
  projection.applyCollected(WORKFLOW)
  expect(graph.getNodeById(toNodeId(1))).toBeNull()
  sender.abortIfUnbound()
  sender.resume()
  expect(sent).toHaveLength(2)
  expect(sent[1].workflowId).toBe(WORKFLOW)
  expect(sent[1].ops[0]).toMatchObject({ op: 'delete_node', node_id: 1 })

  const teardown = () => {
    sender.detach()
    projection.destroy()
    follower.destroy()
    host.destroy()
  }
  return {
    graph,
    sent,
    applyToHost,
    deliverFromHost,
    acknowledge,
    teardown
  }
}

describe('agent-added node delete across a tab switch', () => {
  it('delivers a delete held across the switch and the node stays gone once its effect lands', () => {
    const race = setupRaceUntilReturn()

    race.applyToHost(race.sent[1].ops)
    race.deliverFromHost()
    race.acknowledge(race.sent[1].ops)

    expect(race.graph.getNodeById(toNodeId(1))).toBeNull()
    race.teardown()
  })

  it('the rebind sync leaves the node alone while its delete is still in flight', () => {
    const race = setupRaceUntilReturn()

    // The resubscribe catch-up arrives before the delete has landed on the
    // server: the doc still holds node 1, but its delete is pending locally.
    race.deliverFromHost()
    expect(race.graph.getNodeById(toNodeId(1))).toBeNull()

    race.applyToHost(race.sent[1].ops)
    race.deliverFromHost()
    race.acknowledge(race.sent[1].ops)
    expect(race.graph.getNodeById(toNodeId(1))).toBeNull()
    race.teardown()
  })
})
