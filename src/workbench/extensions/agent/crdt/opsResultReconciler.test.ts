/**
 * Outcome-aware `doc_ops_result` reconciliation (s3-opt-2 / CRDT-RM-3). The
 * behaviour under test: one host acceptance frame drives per-op transitions —
 * applied prefix KEPT pending its effect, failed op + unprocessed suffix
 * ROLLED BACK (never whole-batch rollback from `ok:false`), and skipped
 * duplicates cleared only on an authoritative PROJECTION transition covering
 * the ack's seq (never on the ack itself, never waiting forever). Malformed
 * or unmatched frames are recorded no-ops, and a redelivered result cannot
 * double-revert.
 */
import { describe, expect, it } from 'vitest'

import type { OpsResultReport } from './opsResultReconciler'
import { createOpsResultReconciler } from './opsResultReconciler'
import { createPendingOpLedger } from './pendingOpLedger'
import type { ShadowChange } from './pendingOpShadow'
import { createPendingOpShadowSurface } from './pendingOpShadow'

/** Ledger + shadow with `opIds` enqueued, shown, and marked in flight. */
function setup(opIds: string[], startSeq = 0) {
  const ledger = createPendingOpLedger<string>()
  const shadow = createPendingOpShadowSurface()
  const changes: ShadowChange[] = []
  shadow.subscribe((change) => changes.push(change))
  for (const opId of opIds) {
    expect(ledger.enqueue(opId, `shadow-${opId}`)).toBe(true)
    expect(shadow.show(opId, [{ kind: 'node', nodeId: opId }])).toBe(true)
  }
  expect(ledger.markInFlight(opIds)).toEqual([])
  const seq = { value: startSeq }
  const reconciler = createOpsResultReconciler({
    ledger,
    shadow,
    currentSeq: () => seq.value
  })
  return { ledger, shadow, changes, seq, reconciler }
}

const removalsOf = (changes: ShadowChange[]) =>
  changes.filter((c) => c.type === 'revert' || c.type === 'clear')

describe('failure reconciliation', () => {
  it('keeps the applied prefix and rolls back only the failed op and unprocessed suffix', () => {
    const { ledger, shadow, changes, reconciler } = setup([
      'op-a',
      'op-b',
      'op-c',
      'op-d'
    ])
    const report: OpsResultReport = reconciler.reconcile(
      {
        ok: false,
        applied: ['op-a'],
        skipped: [],
        failed: { op_id: 'op-b', code: 'bad_link', message: 'nope' }
      },
      [{ opIds: ['op-a', 'op-b', 'op-c', 'op-d'] }]
    )
    expect(report.matched).toBe(true)
    expect(report.appliedKept).toEqual(['op-a'])
    expect(report.rolledBack).toEqual(['op-b', 'op-c', 'op-d'])

    // ok:false never rolled back the prefix: op-a stays pending its effect.
    expect(ledger.get('op-a')?.state).toBe('applied')
    expect(shadow.get('op-a')).toBeDefined()

    // Failed op + suffix left both surfaces, via the rollback verb.
    for (const opId of ['op-b', 'op-c', 'op-d']) {
      expect(ledger.get(opId)).toBeUndefined()
      expect(shadow.get(opId)).toBeUndefined()
    }
    expect(removalsOf(changes)).toEqual([
      { type: 'revert', opId: 'op-b' },
      { type: 'revert', opId: 'op-c' },
      { type: 'revert', opId: 'op-d' }
    ])
  })

  it('rolls back the whole remainder when the failure has no identifiable op id', () => {
    const { ledger, shadow, reconciler } = setup(['op-a', 'op-b'])
    const report = reconciler.reconcile(
      { ok: false, applied: ['op-a'], skipped: [], failed: { code: 'boom' } },
      [{ opIds: ['op-a', 'op-b'] }]
    )
    expect(report.appliedKept).toEqual(['op-a'])
    expect(report.rolledBack).toEqual(['op-b'])
    expect(ledger.get('op-a')?.state).toBe('applied')
    expect(shadow.get('op-b')).toBeUndefined()
  })
})

describe('skipped-duplicate clearance', () => {
  it('clears immediately when the projected seq already covers the ack seq', () => {
    const { ledger, changes, reconciler } = setup(['op-x'], 7)
    const report = reconciler.reconcile(
      { ok: true, applied: [], skipped: ['op-x'], seq: 5 },
      [{ opIds: ['op-x'] }]
    )
    expect(report.skippedCleared).toEqual(['op-x'])
    expect(report.skippedAwaiting).toEqual([])
    expect(ledger.get('op-x')).toBeUndefined()
    // Resolution, not rollback: the removal verb is `clear`.
    expect(removalsOf(changes)).toEqual([{ type: 'clear', opId: 'op-x' }])
  })

  it('waits for a covering projection transition, never clearing on the ack', () => {
    const { ledger, shadow, changes, reconciler } = setup(['op-x'], 3)
    const report = reconciler.reconcile(
      { ok: true, applied: [], skipped: ['op-x'], seq: 5 },
      [{ opIds: ['op-x'] }]
    )
    expect(report.skippedAwaiting).toEqual(['op-x'])
    expect(shadow.get('op-x')).toBeDefined()
    expect(ledger.get('op-x')?.state).toBe('skipped')

    // A projection BELOW the ack seq proves nothing; the shadow stays.
    expect(reconciler.onAuthoritativeState(4)).toEqual([])
    expect(shadow.get('op-x')).toBeDefined()

    // The first covering projection clears it, with the `clear` verb.
    expect(reconciler.onAuthoritativeState(5)).toEqual(['op-x'])
    expect(shadow.get('op-x')).toBeUndefined()
    expect(ledger.get('op-x')).toBeUndefined()
    expect(removalsOf(changes)).toEqual([{ type: 'clear', opId: 'op-x' }])
  })

  it('treats a seq-less ack as satisfied by any later authoritative transition', () => {
    const { shadow, reconciler } = setup(['op-x'], 9)
    const report = reconciler.reconcile(
      { ok: true, applied: [], skipped: ['op-x'] },
      [{ opIds: ['op-x'] }]
    )
    // No ack seq → coverage is unprovable at reconcile time, even caught up.
    expect(report.skippedAwaiting).toEqual(['op-x'])
    expect(shadow.get('op-x')).toBeDefined()

    expect(reconciler.onAuthoritativeState(1)).toEqual(['op-x'])
    expect(shadow.get('op-x')).toBeUndefined()
  })

  it('does not let a seq-less transition satisfy a numbered requirement', () => {
    const { shadow, reconciler } = setup(['op-x'], 0)
    reconciler.reconcile({ ok: true, applied: [], skipped: ['op-x'], seq: 5 }, [
      { opIds: ['op-x'] }
    ])
    expect(reconciler.onAuthoritativeState(null)).toEqual([])
    expect(shadow.get('op-x')).toBeDefined()
    expect(reconciler.onAuthoritativeState(5)).toEqual(['op-x'])
  })
})

describe('validation and correlation', () => {
  it('records a malformed frame as a no-op instead of throwing or guessing', () => {
    const { ledger, shadow, reconciler } = setup(['op-a'])
    for (const malformed of [null, 42, 'nope', {}, { ok: 'yes' }]) {
      const report = reconciler.reconcile(malformed, [{ opIds: ['op-a'] }])
      expect(report.matched).toBe(false)
    }
    expect(ledger.get('op-a')?.state).toBe('inflight')
    expect(shadow.get('op-a')).toBeDefined()
  })

  it('ignores a result whose op ids match no unreconciled sent batch', () => {
    const { ledger, reconciler } = setup(['op-a'])
    const report = reconciler.reconcile(
      { ok: true, applied: ['op-foreign'], skipped: [] },
      [{ opIds: ['op-a'] }]
    )
    expect(report.matched).toBe(false)
    expect(report.unknown).toEqual(['op-foreign'])
    expect(ledger.get('op-a')?.state).toBe('inflight')
  })

  it('reconciles each sent batch at most once, so redelivery cannot double-revert', () => {
    const { ledger, changes, reconciler } = setup(['op-a', 'op-b'])
    const result = {
      ok: false,
      applied: ['op-a'],
      skipped: [],
      failed: { op_id: 'op-b' }
    }
    const batches = [{ opIds: ['op-a', 'op-b'] }]
    expect(reconciler.reconcile(result, batches).matched).toBe(true)
    const redelivered = reconciler.reconcile(result, batches)
    expect(redelivered.matched).toBe(false)
    expect(ledger.get('op-a')?.state).toBe('applied')
    expect(removalsOf(changes)).toEqual([{ type: 'revert', opId: 'op-b' }])
  })

  it('correlates against the earliest unreconciled batch that mentions the ids', () => {
    const { ledger, reconciler } = setup(['op-a', 'op-b'])
    const batches = [{ opIds: ['op-a'] }, { opIds: ['op-b'] }]
    const first = reconciler.reconcile(
      { ok: true, applied: ['op-b'], skipped: [] },
      batches
    )
    expect(first.batch).toEqual(['op-b'])
    expect(ledger.get('op-b')?.state).toBe('applied')
    expect(ledger.get('op-a')?.state).toBe('inflight')
  })
})

describe('reset', () => {
  it('drops awaiting-skipped bookkeeping so a stale ack cannot clear after doc_reset', () => {
    const { reconciler } = setup(['op-x'], 0)
    reconciler.reconcile({ ok: true, applied: [], skipped: ['op-x'], seq: 5 }, [
      { opIds: ['op-x'] }
    ])
    reconciler.reset()
    expect(reconciler.onAuthoritativeState(999)).toEqual([])
  })
})
