/**
 * Repro: deleting an agent-added node does not persist across a tab switch.
 * Characterizes the interaction between two already-tested-in-isolation
 * behaviors that combine into a bug:
 *
 * - `opSender.ts` binds a batch to the workflow id at ENQUEUE time and only
 *   re-checks that binding against the currently active workflow when the
 *   batch is popped off the FIFO queue to become in-flight (`transmit()`,
 *   opSender.ts ~L117-124). A delete queued behind an earlier in-flight batch
 *   when the tab switches never gets re-addressed: it settles `undeliverable`
 *   (`settleUndeliverable`, ~L142-146) and is dropped without ever reaching
 *   the server. The server's document still has the node.
 * - Locally, deleting a node removes it from the canvas and from the node
 *   store immediately (`LGraph.remove()` -> `detachNodeFromStores()` ->
 *   `unregisterNodeState()` -> `nodeDataStore.deleteNode()`), independent of
 *   whether the corresponding wire op ever lands. It does NOT touch the
 *   follower's Y.Doc, which mirrors the SERVER's state, not the local store.
 * - `useAgentCrdtFollower.ts` rebinds the `EcsFollowerAdapter` session on a
 *   workflow/tab (re)activation, which resets `reconcileNextFrame` to `true`
 *   (`ecsFollowerAdapter.ts` `createSession`, ~L296/L387). The next frame the
 *   adapter applies is therefore treated as a full, authoritative resync: it
 *   reads every node CURRENTLY in the doc and reconciles the store to match
 *   (~L465-496), regardless of whether anything actually changed. Since the
 *   server's doc still has the node whose delete was dropped, this resync
 *   re-adds its record to the local store.
 * - `agentNodeMaterializer.ts`'s `reconcile()` then treats that store record
 *   as ground truth: a record with no live canvas node is recreated
 *   (~L199-244), so the node the user deleted reappears.
 *
 * This test drives the real `opSender`, `EcsFollowerAdapter`, `FollowerDoc`
 * and `reconcileAgentAdapters`, forcing the queued-batch drop and the
 * resubscribe deterministically instead of relying on timing.
 */
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'
import type { GraphOperation } from './graphOperations'
import type { BatchOutcome, OpsResultView } from './opSender'
import { createOpSender } from './opSender'

class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
  }
}

const CATALOG: WidgetCatalog = { types: { dummy: { widget_order: [] } } }

function agentOperation(id: string, version: number, payload: object) {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: version,
    stamp: [version, 'agent:test', id],
    ...payload
  }
}

function addNodePayload(id: number) {
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

describe('agent-added node delete dropped across a tab switch', () => {
  it.fails('KNOWN BUG: a delete dropped by a tab-switch race reappears once the follower resubscribes and reconciles', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    // `host` stands in for the server's canonical Yjs document.
    const host = mint({ nodes: [], links: [] }, CATALOG)
    const follower = new FollowerDoc()
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: () => {}, deleteNodes: () => {} }
    })
    const adapter = new EcsFollowerAdapter(mutations)
    adapter.bind('workflow', follower)

    let opSequence = 0
    let frameSeq = 0
    let sentInitialFrame = false
    const deliverFromHost = (payload?: object) => {
      const stateVector = Y.encodeStateVector(host)
      let opId: string | undefined
      if (payload) {
        opId = `agent-op-${++opSequence}`
        const result = applyOps(
          host,
          [agentOperation(opId, opSequence, payload)] as Parameters<
            typeof applyOps
          >[1],
          CATALOG
        )
        expect(result.outcomes).toEqual([{ op_id: opId, outcome: 'applied' }])
      }
      const update = sentInitialFrame
        ? Y.encodeStateAsUpdate(host, stateVector)
        : Y.encodeStateAsUpdate(host)
      sentInitialFrame = true
      follower.applyRemoteUpdate(update)
      adapter.applyFrame({
        workflowId: 'workflow',
        seq: ++frameSeq,
        update,
        actor: 'agent:test',
        opIds: opId ? [opId] : []
      })
      reconcileAgentAdapters(graph)
    }

    // The agent adds an unrelated node (the z-image-turbo repro): this is
    // the very first frame, so it lands through the initial full sync.
    deliverFromHost(addNodePayload(1))
    expect(graph.getNodeById(toNodeId(1))).toBeTruthy()

    // Wire a real opSender bound to workflow "wf-a", the way
    // useAgentCrdtFollower does for the human write leg.
    let boundWorkflow: string | null = 'wf-a'
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
      baseVersion: () => 0,
      onBatchSettled: (outcome) => settled.push(outcome)
    })

    // An earlier, unrelated edit is already in flight on wf-a...
    sender.enqueue([{ op: 'set_widget', node_id: 2, widget: 'x', value: 1 }])
    expect(sent).toHaveLength(1)

    // ...so the human's delete of the unwanted node queues up behind it
    // instead of transmitting immediately.
    sender.enqueue([deleteNodeOp(1)])
    expect(sent).toHaveLength(1)

    // The user deletes the node on the canvas right away: gone from the
    // live graph and the local node store, but the server (`host`) never
    // heard about it yet.
    const node = graph.getNodeById(toNodeId(1))!
    graph.remove(node)
    expect(graph.getNodeById(toNodeId(1))).toBeNull()
    expect(
      useNodeDataStore().getNode(scope.rootGraphId, toNodeId(1))
    ).toBeUndefined()

    // The user switches to another workflow tab before the in-flight
    // batch's result comes back.
    boundWorkflow = 'wf-b'

    // The in-flight batch now settles (its own result arrives as normal);
    // opSender pops the queued delete next and re-checks its binding
    // against the now-active workflow, per opSender.ts ~L121-124.
    const inFlightOpId = sent[0].ops[0].op_id
    listenerBox.resultListener?.({
      ok: true,
      applied: [inFlightOpId],
      skipped: []
    })

    // The delete was dropped without ever reaching the server: no second
    // send happened for it, and it settled 'undeliverable'. `host` was
    // never told to delete node 1.
    expect(sent).toHaveLength(1)
    expect(settled.map((outcome) => outcome.state)).toEqual([
      'acknowledged',
      'undeliverable'
    ])

    // The user switches back to the workflow tab. The follower rebinds
    // (`useAgentCrdtFollower` re-subscribes on activation), which arms a
    // full reconcile for the next frame it applies.
    boundWorkflow = 'wf-a'
    adapter.bind('workflow', follower)

    // Any subsequent frame from the server triggers that full reconcile,
    // reading every node the server's doc still has -- including node 1,
    // whose delete never arrived -- and re-registering it in the store.
    deliverFromHost()

    expect(graph.getNodeById(toNodeId(1))).toBeNull()

    sender.detach()
    adapter.destroy()
    follower.destroy()
    host.destroy()
  })
})
