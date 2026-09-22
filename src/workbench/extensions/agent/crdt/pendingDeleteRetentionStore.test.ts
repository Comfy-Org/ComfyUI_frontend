/**
 * Store-level coverage for the capture/settle correlation the composable
 * relies on (see `useAgentCrdtFollower.test.ts` for the composable's own
 * behavior through the real coalescer/sender). Constructing `BatchOutcome`s
 * directly here proves the correlation logic at the lowest level it can be
 * observed, without needing a real Yjs doc, sender, or coalescer.
 */
import type { Op } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'

import type { BatchOutcome } from './opSender'
import { createPendingDeleteRetentionStore } from './pendingDeleteRetentionStore'

const ACTOR = 'human:test-user:tab-1'

function deleteOp(opId: string, nodeId: string): Op {
  return {
    op: 'delete_node',
    op_id: opId,
    node_id: nodeId,
    removed_links: [],
    actor: ACTOR,
    base_version: 0,
    stamp: [0, ACTOR]
  }
}

function acknowledged(
  workflowId: string,
  ops: Op[],
  applied: string[]
): BatchOutcome {
  return {
    workflowId,
    state: 'acknowledged',
    ops,
    result: {
      ok: true,
      applied,
      skipped: ops.map((op) => op.op_id).filter((id) => !applied.includes(id))
    }
  }
}

describe('createPendingDeleteRetentionStore', () => {
  it('associates a delete settled after a later same-id delete was already captured with its OWN identity, not the later one', () => {
    const store = createPendingDeleteRetentionStore()

    // Node '1' is deleted as incarnation A; before A's own result settles,
    // it is recreated and deleted again as incarnation B.
    store.captureDeleteIntent('wf-1', '1', 'A')
    store.captureDeleteIntent('wf-1', '1', 'B')

    // A's result settles first, B's second - matching capture order.
    store.settleBatch(acknowledged('wf-1', [deleteOp('op-a', '1')], ['op-a']))
    store.settleBatch(acknowledged('wf-1', [deleteOp('op-b', '1')], ['op-b']))

    const docNodeIds = new Set(['1'])
    // The retained identity is B's (the later delete's own), not A's stale
    // one and not a null fallback that would match anything.
    expect(store.retainedNodeIds('wf-1', docNodeIds, () => 'B')).toEqual(
      new Set(['1'])
    )
    expect(store.retainedNodeIds('wf-1', docNodeIds, () => 'C')).toEqual(
      new Set()
    )
  })

  it('associates two same-tick deletes of one node, settled together, with their own captured identities in issuance order', () => {
    const store = createPendingDeleteRetentionStore()

    store.captureDeleteIntent('wf-1', '1', 'X')
    store.captureDeleteIntent('wf-1', '1', 'Y')
    store.settleBatch(
      acknowledged(
        'wf-1',
        [deleteOp('op-1', '1'), deleteOp('op-2', '1')],
        ['op-1', 'op-2']
      )
    )

    const docNodeIds = new Set(['1'])
    // The second op's own identity (Y) wins, not a mis-paired or null one.
    expect(store.retainedNodeIds('wf-1', docNodeIds, () => 'Y')).toEqual(
      new Set(['1'])
    )
    expect(store.retainedNodeIds('wf-1', docNodeIds, () => 'Z')).toEqual(
      new Set()
    )
  })

  it('consumes a capture even when its own delete is skipped, so it cannot leak into a later, unrelated delete of the same node', () => {
    const store = createPendingDeleteRetentionStore()

    // The host rejects the first delete outright (skipped, not applied).
    store.captureDeleteIntent('wf-1', '1', 'A')
    store.settleBatch(acknowledged('wf-1', [deleteOp('op-a', '1')], []))

    // A second, unrelated delete of the (recreated) same node id follows.
    store.captureDeleteIntent('wf-1', '1', 'B')
    store.settleBatch(acknowledged('wf-1', [deleteOp('op-b', '1')], ['op-b']))

    const docNodeIds = new Set(['1'])
    expect(store.retainedNodeIds('wf-1', docNodeIds, () => 'B')).toEqual(
      new Set(['1'])
    )
    expect(store.retainedNodeIds('wf-1', docNodeIds, () => 'A')).toEqual(
      new Set()
    )
  })

  it('drops both retained deletes and any unconsumed capture for one workflow only', () => {
    const store = createPendingDeleteRetentionStore()

    store.captureDeleteIntent('wf-1', '1', 'A')
    store.settleBatch(acknowledged('wf-1', [deleteOp('op-a', '1')], ['op-a']))
    store.captureDeleteIntent('wf-2', '9', 'Z')
    store.settleBatch(acknowledged('wf-2', [deleteOp('op-z', '9')], ['op-z']))

    store.clearWorkflow('wf-1')

    expect(store.retainedNodeIds('wf-1', new Set(['1']), () => 'A')).toEqual(
      new Set()
    )
    expect(store.retainedNodeIds('wf-2', new Set(['9']), () => 'Z')).toEqual(
      new Set(['9'])
    )
  })

  it('ignores a batch settled without a workflow id', () => {
    const store = createPendingDeleteRetentionStore()
    expect(() =>
      store.settleBatch({
        workflowId: null,
        state: 'undeliverable',
        ops: [deleteOp('op-x', '1')]
      })
    ).not.toThrow()
    expect(store.retainedNodeIds('wf-1', new Set(['1']), () => null)).toEqual(
      new Set()
    )
  })
})
