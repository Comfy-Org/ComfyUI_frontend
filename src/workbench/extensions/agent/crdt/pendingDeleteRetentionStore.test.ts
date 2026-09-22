/**
 * Store-level coverage for the retention state machine (see
 * `useAgentCrdtFollower.test.ts` for the composable's own behavior through
 * the real coalescer/sender). Constructing `BatchOutcome`s directly here,
 * with each delete's captured identity already bound to its own `op_id`
 * (as `opSender.ts`'s `admit()` binds it), proves the retention logic at the
 * lowest level it can be observed, without needing a real Yjs doc, sender,
 * or coalescer.
 */
import type { Op } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, vi } from 'vitest'

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
  applied: string[],
  deletedItemIds: ReadonlyMap<string, string | null> = new Map()
): BatchOutcome {
  return {
    workflowId,
    state: 'acknowledged',
    ops,
    result: {
      ok: true,
      applied,
      skipped: ops.map((op) => op.op_id).filter((id) => !applied.includes(id))
    },
    deletedItemIds
  }
}

function unconfirmed(
  workflowId: string,
  ops: Op[],
  deletedItemIds: ReadonlyMap<string, string | null> = new Map()
): BatchOutcome {
  return { workflowId, state: 'unconfirmed', ops, deletedItemIds }
}

describe('createPendingDeleteRetentionStore', () => {
  it('associates each delete with its OWN identity via its own op_id, not another delete of the same node', () => {
    const store = createPendingDeleteRetentionStore()

    // Node '1' is deleted as incarnation A, recreated, and deleted again as
    // incarnation B - both ops settle in the same batch.
    store.settleBatch(
      acknowledged(
        'wf-1',
        [deleteOp('op-a', '1'), deleteOp('op-b', '1')],
        ['op-a', 'op-b'],
        new Map([
          ['op-a', 'A'],
          ['op-b', 'B']
        ])
      )
    )

    const docNodeIds = new Set(['1'])
    // The later op's own identity (B) wins, not a mis-paired or null one.
    expect(store.retainedNodeIds('wf-1', docNodeIds, () => 'B')).toEqual(
      new Set(['1'])
    )
    expect(store.retainedNodeIds('wf-1', docNodeIds, () => 'A')).toEqual(
      new Set()
    )
  })

  it('never retains a delete the host reports skipped, even though it consumed a wire slot', () => {
    const store = createPendingDeleteRetentionStore()

    store.settleBatch(
      acknowledged(
        'wf-1',
        [deleteOp('op-a', '1')],
        [],
        new Map([['op-a', 'A']])
      )
    )

    expect(store.retainedNodeIds('wf-1', new Set(['1']), () => 'A')).toEqual(
      new Set()
    )
  })

  it('drops one workflow only', () => {
    const store = createPendingDeleteRetentionStore()

    store.settleBatch(
      acknowledged(
        'wf-1',
        [deleteOp('op-a', '1')],
        ['op-a'],
        new Map([['op-a', 'A']])
      )
    )
    store.settleBatch(
      acknowledged(
        'wf-2',
        [deleteOp('op-z', '9')],
        ['op-z'],
        new Map([['op-z', 'Z']])
      )
    )

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
        ops: [deleteOp('op-x', '1')],
        deletedItemIds: new Map()
      })
    ).not.toThrow()
    expect(store.retainedNodeIds('wf-1', new Set(['1']), () => null)).toEqual(
      new Set()
    )
  })

  it('a confirmed delete with no captured identity does not stay retained forever once a new item occupies the id', () => {
    // Regression: a delete admitted while its target existed only as a
    // local, not-yet-synced add captures no Yjs identity (null). Without a
    // bound expiry, that record could suppress any later, unrelated node
    // recreated under the same id indefinitely.
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const store = createPendingDeleteRetentionStore()

    store.settleBatch(
      acknowledged(
        'wf-1',
        [deleteOp('op-a', '1')],
        ['op-a'],
        new Map([['op-a', null]])
      )
    )

    // Still within the window: a lagging reconcile must not resurrect it.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'new-item')
    ).toEqual(new Set(['1']))

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)

    // A day later, a real node now occupies the id: the bounded,
    // identity-less retention has expired, so the new node is not
    // suppressed.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'new-item')
    ).toEqual(new Set())
    vi.useRealTimers()
  })

  it('an unknown outcome with no captured identity is bounded exactly like a confirmed one with no identity', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const store = createPendingDeleteRetentionStore()

    store.settleBatch(
      unconfirmed('wf-1', [deleteOp('op-a', '1')], new Map([['op-a', null]]))
    )

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)

    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'new-item')
    ).toEqual(new Set())
    vi.useRealTimers()
  })

  it('a confirmed delete WITH a captured identity is never bounded by time, only by a different identity occupying the id', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const store = createPendingDeleteRetentionStore()

    store.settleBatch(
      acknowledged(
        'wf-1',
        [deleteOp('op-a', '1')],
        ['op-a'],
        new Map([['op-a', 'A']])
      )
    )

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)

    // Still no other identity at this id: stays retained, unbounded by time.
    expect(store.retainedNodeIds('wf-1', new Set(['1']), () => 'A')).toEqual(
      new Set(['1'])
    )
    // A different identity now occupies the id: released regardless of time.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'different')
    ).toEqual(new Set())
    vi.useRealTimers()
  })

  it('an unreadable current identity is not proof of supersession, only a real, differing one is', () => {
    // Regression: `currentItemId` returns null both when the id was never
    // set and when a real item's identity failed to read (e.g. an internal
    // Yjs-shape read failure). Treating null as "a different item replaced
    // this one" would release suppression while the node the confirmed
    // delete removed may still be sitting there in an unreadable shape,
    // letting a lagging reconcile resurrect it.
    const store = createPendingDeleteRetentionStore()

    store.settleBatch(
      acknowledged(
        'wf-1',
        [deleteOp('op-a', '1')],
        ['op-a'],
        new Map([['op-a', 'A']])
      )
    )

    // The doc still lists id '1' (it exists in some shape) but reading its
    // identity fails: retention must NOT be released.
    expect(store.retainedNodeIds('wf-1', new Set(['1']), () => null)).toEqual(
      new Set(['1'])
    )
    // A real, differing identity still releases it as before.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'different')
    ).toEqual(new Set())
  })

  it('does not let a stronger, earlier-expiring record expire a later, independent delete intent early', () => {
    // Regression: reason strength (confirmed > unknown) must not override a
    // later record's own expiry when the two records' identities are not
    // directly comparable (one carries none). Settle an identity-less
    // confirmed delete first, then before its deadline settle a later
    // `unknown` delete for a different, known identity B: B's own later
    // expiry window must survive, not be replaced by the earlier record's
    // sooner deadline.
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const store = createPendingDeleteRetentionStore()

    store.settleBatch(
      acknowledged(
        'wf-1',
        [deleteOp('op-a', '1')],
        ['op-a'],
        new Map([['op-a', null]])
      )
    )

    vi.setSystemTime(1000)
    store.settleBatch(
      unconfirmed('wf-1', [deleteOp('op-b', '1')], new Map([['op-b', 'B']]))
    )

    // Just past the FIRST record's own (earlier) deadline (settled at t=0,
    // expiring at t=30_000): the merged record must still be retained,
    // because the second, later delete's own ambiguity window is still
    // open.
    vi.setSystemTime(30_000 + 1)
    expect(store.retainedNodeIds('wf-1', new Set(['1']), () => 'B')).toEqual(
      new Set(['1'])
    )

    // Past the SECOND record's own (later) deadline (settled at t=1_000,
    // expiring at t=31_000): now it expires.
    vi.setSystemTime(31_000 + 1)
    expect(store.retainedNodeIds('wf-1', new Set(['1']), () => 'B')).toEqual(
      new Set()
    )
    vi.useRealTimers()
  })
})
