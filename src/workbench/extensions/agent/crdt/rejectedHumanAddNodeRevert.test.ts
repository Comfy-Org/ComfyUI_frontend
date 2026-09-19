/**
 * Regression pin: a human-authored `add_node` the host
 * rejects never leaves the canvas. `layoutMintPort.ts`'s `createNode` handler
 * mints the wire op AFTER the node is already live via the normal LiteGraph
 * flow (optimistic-by-construction), and `pendingOpTracker.test.ts` already
 * proves the ledger computes the correct `reverted` outcome for a rejected
 * op. The gap is downstream: `useAgentCrdtFollower.ts` wires that event to
 * `recordDevEvent('pending_ops', event)` only, so the failure reaches the dev
 * panel and nothing else. This test composes the same three real modules
 * `useAgentCrdtFollower.ts` composes - `attachMintPortWiring`,
 * `createOpSender`, `createPendingOpTracker` - over a fake graph, so the
 * missing revert is pinned against production wiring rather than a
 * reimplementation of it. `it.fails` keeps the assertions expressing the
 * CORRECT behavior; convert to a plain `it` the day something consumes a
 * `reverted` event to remove the node.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import type { Op } from '@comfyorg/comfy-multi-player'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { toNodeId } from '@/types/nodeId'

import type { LayoutChangeView } from './layoutMintPort'
import { attachMintPortWiring } from './mintPortWiring'
import type { MintableGraph } from './mintPortWiring'
import type { OpsResultView } from './opSender'
import { createOpSender } from './opSender'
import { createPendingOpTracker } from './pendingOpTracker'
import type { PendingOpTrackerEvent } from './pendingOpTracker'

const LOCAL_PREFIX = 'user-'
const LOCAL_ACTOR = 'user-abc123'

/** Structural stand-in for the two LGraphNode members the wiring reads. */
interface FakeGraphNode {
  id: unknown
  type: string
  serialize: () => { id: unknown; type: string }
}

describe('human add_node rejection regression pin', () => {
  let graphNodes: Map<string, FakeGraphNode>
  let layoutListeners: Set<(change: LayoutChangeView) => void>
  let graph: MintableGraph

  function deliverLayoutChange(change: LayoutChangeView): void {
    for (const listener of layoutListeners) listener(change)
  }

  beforeEach(() => {
    graphNodes = new Map()
    layoutListeners = new Set()
    graph = {
      id: 'root',
      rootGraph: { id: 'root' },
      getNodeById: (id) =>
        (graphNodes.get(String(id)) as unknown as LGraphNode | undefined) ??
        null,
      get _nodes() {
        return [...graphNodes.values()] as unknown as LGraphNode[]
      }
    }
  })

  it.fails('removes the node from the graph after the host rejects its sync', () => {
    const trackerEvents: PendingOpTrackerEvent[] = []
    const tracker = createPendingOpTracker({
      onEvent: (event) => trackerEvents.push(event)
    })

    const sentBatches: Op[][] = []
    let resultListener: (result: OpsResultView) => void = () => {}
    const sender = createOpSender({
      sendOps: (_workflowId, _tab, ops) => {
        sentBatches.push(ops)
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return () => {}
      },
      workflowId: () => 'wf-1',
      tab: 'tab-1',
      actor: () => 'human:test-user:tab-1',
      baseVersion: () => 0,
      onBatchMinted: (ops) => tracker.onBatchMinted(ops),
      onBatchTransmitted: (ops) => tracker.onBatchTransmitted(ops),
      onBatchSettled: (outcome) => tracker.onBatchSettled(outcome)
    })

    const wiring = attachMintPortWiring({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (operations) => sender.enqueue(operations),
      layoutChanges: (listener) => {
        layoutListeners.add(listener)
        return () => layoutListeners.delete(listener)
      },
      localActorPrefix: LOCAL_PREFIX,
      getGraph: () => graph
    })

    // The normal LiteGraph flow already added the node before the layout
    // store's change feed fires (layoutMintPort.ts mints from AFTER state).
    graphNodes.set('1', {
      id: toNodeId(1),
      type: 'LoadImage',
      serialize: () => ({ id: toNodeId(1), type: 'LoadImage' })
    })
    deliverLayoutChange({
      operation: {
        type: 'createNode',
        actor: LOCAL_ACTOR,
        nodeId: toNodeId(1),
        layout: { position: { x: 100, y: 100 } }
      }
    })

    expect(sentBatches).toHaveLength(1)
    const mintedOpId = sentBatches[0][0].op_id

    // The host rejects the sync (real report: invalid_node_payload, node
    // carries the reserved key '__incarnation').
    resultListener({
      ok: false,
      applied: [],
      skipped: [],
      failure: { op_id: mintedOpId }
    })

    // The ledger correctly computes the revert...
    expect(trackerEvents).toContainEqual({
      type: 'reverted',
      reason: 'failed',
      opIds: [mintedOpId]
    })

    // ...but nothing consumes it: the node the host never accepted is
    // still on the graph. Desired behavior once fixed: it is gone.
    expect(graphNodes.has('1')).toBe(false)

    wiring.detach()
  })
})
