/**
 * Store-level coverage for the retention state machine (see
 * `useAgentCrdtFollower.test.ts` for the composable's own behavior through
 * the real coalescer/sender). Constructing {@link RetainedDeleteCandidate}s
 * directly here proves the retention logic at the lowest level it can be
 * observed, without needing a real Yjs doc, sender, or coalescer.
 *
 * `retainedNodeIds()` prunes as a side effect of reading, so any assertion
 * that queries with a DIFFERENT `currentItemId` than a previous assertion on
 * the SAME store can release state that a later assertion then depends on
 * for the wrong reason. Each such case below therefore gets its own fresh
 * store, never reusing one a prior destructive read already touched.
 */
import { describe, expect, it, vi } from 'vitest'

import { createPendingDeleteRetentionStore } from './pendingDeleteRetentionStore'
import type {
  RetainedDeleteCandidate,
  RetentionReason
} from './pendingDeleteRetentionStore'

function del(
  workflowId: string,
  nodeId: string,
  reason: RetentionReason,
  identity: string | null
): RetainedDeleteCandidate {
  return { workflowId, nodeId, reason, identity }
}

describe('createPendingDeleteRetentionStore', () => {
  it('never retains a delete the host reports skipped, even though it consumed a wire slot', () => {
    const store = createPendingDeleteRetentionStore()
    // A skipped delete never becomes a candidate in production (see
    // useAgentCrdtFollower.ts's adapter); the store itself is never told
    // about it, so there is nothing to retain.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'A', true)
    ).toEqual(new Set())
  })

  it('drops one workflow only', () => {
    const store = createPendingDeleteRetentionStore()

    store.settleBatch([del('wf-1', '1', 'confirmed-applied', 'A')])
    store.settleBatch([del('wf-2', '9', 'confirmed-applied', 'Z')])

    store.clearWorkflow('wf-1')

    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'A', true)
    ).toEqual(new Set())
    expect(
      store.retainedNodeIds('wf-2', new Set(['9']), () => 'Z', true)
    ).toEqual(new Set(['9']))
  })

  it('ignores an empty candidate list', () => {
    const store = createPendingDeleteRetentionStore()
    expect(() => store.settleBatch([])).not.toThrow()
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => null, true)
    ).toEqual(new Set())
  })

  it('a confirmed delete with no captured identity does not stay retained forever once a new item occupies the id', () => {
    // Regression: a delete admitted while its target existed only as a
    // local, not-yet-synced add captures no Yjs identity (null). Without a
    // bound expiry, that record could suppress any later, unrelated node
    // recreated under the same id indefinitely.
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const store = createPendingDeleteRetentionStore()

    store.settleBatch([del('wf-1', '1', 'confirmed-applied', null)])

    // Still within the window: a lagging reconcile must not resurrect it.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'new-item', true)
    ).toEqual(new Set(['1']))

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)

    // A day later, a real node now occupies the id: the bounded,
    // identity-less retention has expired, so the new node is not
    // suppressed.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'new-item', true)
    ).toEqual(new Set())
    vi.useRealTimers()
  })

  it('an unknown outcome with no captured identity is bounded exactly like a confirmed one with no identity', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const store = createPendingDeleteRetentionStore()

    store.settleBatch([del('wf-1', '1', 'unknown', null)])

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)

    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'new-item', true)
    ).toEqual(new Set())
    vi.useRealTimers()
  })

  it('a confirmed delete WITH a captured identity is never bounded by time, only by a different identity occupying the id', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const store = createPendingDeleteRetentionStore()

    store.settleBatch([del('wf-1', '1', 'confirmed-applied', 'A')])

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)

    // Still no other identity at this id: stays retained, unbounded by time.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'A', true)
    ).toEqual(new Set(['1']))
    // A different identity now occupies the id: released regardless of time.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'different', true)
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

    store.settleBatch([del('wf-1', '1', 'confirmed-applied', 'A')])

    // The doc still lists id '1' (it exists in some shape) but reading its
    // identity fails: retention must NOT be released.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => null, true)
    ).toEqual(new Set(['1']))
    // A real, differing identity still releases it as before.
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'different', true)
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

    store.settleBatch([del('wf-1', '1', 'confirmed-applied', null)])

    vi.setSystemTime(1000)
    store.settleBatch([del('wf-1', '1', 'unknown', 'B')])

    // Just past the FIRST record's own (earlier) deadline (settled at t=0,
    // expiring at t=30_000): the merged record must still be retained,
    // because the second, later delete's own ambiguity window is still
    // open.
    vi.setSystemTime(30_000 + 1)
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'B', true)
    ).toEqual(new Set(['1']))

    // Past the SECOND record's own (later) deadline (settled at t=1_000,
    // expiring at t=31_000): now it expires.
    vi.setSystemTime(31_000 + 1)
    expect(
      store.retainedNodeIds('wf-1', new Set(['1']), () => 'B', true)
    ).toEqual(new Set())
    vi.useRealTimers()
  })

  describe('two records for the same node id, settled in either order', () => {
    it.for([['A', 'B'] as const, ['B', 'A'] as const])(
      'keeps only the LATER of two settled deletes naming different real identities, settled %s-then-%s',
      ([first, second]) => {
        // Distinct real identities never share a bucket (see
        // `insertRetainedDelete`): the later settle always drops the
        // earlier one, regardless of which identity happens to be first or
        // second alphabetically.
        const store = createPendingDeleteRetentionStore()
        store.settleBatch([del('wf-1', '1', 'confirmed-applied', first)])
        store.settleBatch([del('wf-1', '1', 'confirmed-applied', second)])

        expect(
          store.retainedNodeIds('wf-1', new Set(['1']), () => second, true)
        ).toEqual(new Set(['1']))
      }
    )

    it.for([
      ['permanent', 'bounded'] as const,
      ['bounded', 'permanent'] as const
    ])(
      'keeps a permanent identified record and an independent bounded unidentified record for the same node both alive, settled %s-then-%s',
      ([first, second]) => {
        // Regression: a permanent record (an identified `confirmed-applied`)
        // must not replace an independently live bounded record for the
        // same node id, and vice versa - they name different identity
        // buckets (a real one vs none) and never merge.
        vi.useFakeTimers()
        vi.setSystemTime(0)
        const settle = {
          permanent: (
            store: ReturnType<typeof createPendingDeleteRetentionStore>
          ) => store.settleBatch([del('wf-1', '1', 'confirmed-applied', 'A')]),
          bounded: (
            store: ReturnType<typeof createPendingDeleteRetentionStore>
          ) => store.settleBatch([del('wf-1', '1', 'unknown', null)])
        }

        // Fresh store per assertion below: `retainedNodeIds` prunes on
        // read, so reusing one store across a same-identity and a
        // different-identity query would let the first query's prune hide
        // whether the SECOND query's record was ever independently there.
        const withBothSettled = () => {
          const store = createPendingDeleteRetentionStore()
          settle[first](store)
          settle[second](store)
          return store
        }

        // A different, real identity (B) supersedes only the permanent
        // record; the unidentified bounded one has no identity to be
        // superseded by, so it alone keeps the node suppressed.
        expect(
          withBothSettled().retainedNodeIds(
            'wf-1',
            new Set(['1']),
            () => 'B',
            true
          )
        ).toEqual(new Set(['1']))

        // Querying with the PERMANENT record's OWN identity (A, not a
        // different one) independently proves it is still there on its own
        // terms, even once the unidentified bounded record's 30s window has
        // separately expired.
        const store = withBothSettled()
        vi.setSystemTime(30_000 + 1)
        expect(
          store.retainedNodeIds('wf-1', new Set(['1']), () => 'A', true)
        ).toEqual(new Set(['1']))
        vi.useRealTimers()
      }
    )

    it.for([
      ['unidentified', 'identified-bounded'] as const,
      ['identified-bounded', 'unidentified'] as const
    ])(
      'keeps an unidentified bounded record and a DIFFERENT-identity bounded record for the same node both alive, settled %s-then-%s',
      ([first, second]) => {
        // Neither name the same bucket (null vs a real identity) and
        // neither is permanent: both are independent, time-bounded records
        // that must each survive on their own terms.
        vi.useFakeTimers()
        vi.setSystemTime(0)
        const settle = {
          unidentified: (
            store: ReturnType<typeof createPendingDeleteRetentionStore>
          ) => store.settleBatch([del('wf-1', '1', 'unknown', null)]),
          'identified-bounded': (
            store: ReturnType<typeof createPendingDeleteRetentionStore>
          ) => store.settleBatch([del('wf-1', '1', 'unknown', 'C')])
        }
        const store = createPendingDeleteRetentionStore()
        settle[first](store)
        settle[second](store)

        // C's own identity does not supersede the unidentified record
        // (nothing can), and C's own record is not superseded by itself:
        // both keep the node suppressed until they individually expire.
        expect(
          store.retainedNodeIds('wf-1', new Set(['1']), () => 'C', true)
        ).toEqual(new Set(['1']))

        vi.advanceTimersByTime(30_000 + 1)
        expect(
          store.retainedNodeIds('wf-1', new Set(['1']), () => 'C', true)
        ).toEqual(new Set())
        vi.useRealTimers()
      }
    )

    it.for([
      ['permanent', 'bounded-same-identity'] as const,
      ['bounded-same-identity', 'permanent'] as const
    ])(
      'merges a permanent record and a bounded record naming the SAME identity into one permanent record, settled %s-then-%s',
      ([first, second]) => {
        // Both name identity A, the same bucket, so they merge (see
        // `mergeSameIdentityDelete`); the permanent one has no expiry and
        // always wins the merge, regardless of settlement order.
        vi.useFakeTimers()
        vi.setSystemTime(0)
        const settle = {
          permanent: (
            store: ReturnType<typeof createPendingDeleteRetentionStore>
          ) => store.settleBatch([del('wf-1', '1', 'confirmed-applied', 'A')]),
          'bounded-same-identity': (
            store: ReturnType<typeof createPendingDeleteRetentionStore>
          ) => store.settleBatch([del('wf-1', '1', 'unknown', 'A')])
        }
        const store = createPendingDeleteRetentionStore()
        settle[first](store)
        settle[second](store)

        // Long past what the bounded record's own 30s window would have
        // been: the merged record is still retained, because it merged
        // into the permanent one, not the bounded one.
        vi.advanceTimersByTime(24 * 60 * 60 * 1000)
        expect(
          store.retainedNodeIds('wf-1', new Set(['1']), () => 'A', true)
        ).toEqual(new Set(['1']))
        vi.useRealTimers()
      }
    )
  })

  describe('a transient, not-yet-caught-up document read', () => {
    it('does not let an empty replacement read permanently prune a retained delete that a later, authoritative read still needs', () => {
      // Regression (P1): on an ordinary workflow switch, the follower's doc
      // is reminted empty and `follower_replaced` fires before the
      // destination's own catch-up frame arrives. A `retainedNodeIds` read
      // taken inside that window used to treat the empty doc as proof the
      // node was gone and pruned it for good, so the first (possibly
      // stale) authoritative frame that arrived afterward - still showing
      // the deleted incarnation, since the host had not caught up either -
      // resurrected it.
      const store = createPendingDeleteRetentionStore()
      store.settleBatch([del('wf-1', '1', 'confirmed-applied', 'A')])

      // The remint-before-catchup window: an empty doc, not authoritative.
      expect(
        store.retainedNodeIds('wf-1', new Set(), () => null, false)
      ).toEqual(new Set(['1']))

      // The first real frame lands, authoritative, but still stale (the
      // host has not applied the delete yet, so it still shows identity A):
      // retention must still hold.
      expect(
        store.retainedNodeIds('wf-1', new Set(['1']), () => 'A', true)
      ).toEqual(new Set(['1']))
    })

    it('still releases once an authoritative read shows the node truly gone', () => {
      const store = createPendingDeleteRetentionStore()
      store.settleBatch([del('wf-1', '1', 'confirmed-applied', 'A')])

      expect(
        store.retainedNodeIds('wf-1', new Set(), () => null, false)
      ).toEqual(new Set(['1']))

      // The host's real, caught-up state has removed the node entirely.
      expect(
        store.retainedNodeIds('wf-1', new Set(), () => null, true)
      ).toEqual(new Set())
    })
  })
})
