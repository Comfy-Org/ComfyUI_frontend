/**
 * Pending-op ledger (s3-opt-1 / CRDT-RM-3). The behaviour under test: a pure
 * op_id-keyed state machine that enqueues exactly once, transitions each
 * batch member per-outcome on `doc_ops_result` (never whole-batch rollback),
 * preserves applied entries until their authoritative effect (KA-9), and
 * hands entries out only through explicit reconciliation calls.
 */
import { describe, expect, it } from 'vitest'

import type {
  OpsResultOutcome,
  PendingOpEntry,
  PendingOpLedger,
  PendingOpState,
  ReconcileSummary
} from './pendingOpLedger'
import { createPendingOpLedger } from './pendingOpLedger'

const flownBatch = (ledger: PendingOpLedger<string>, opIds: string[]): void => {
  for (const opId of opIds)
    expect(ledger.enqueue(opId, `shadow-${opId}`)).toBe(true)
  expect(ledger.markInFlight(opIds)).toEqual([])
}

const reconcile = (
  ledger: PendingOpLedger<string>,
  outcome: OpsResultOutcome
): ReconcileSummary => ledger.reconcileOpsResult(outcome)

const statesOf = (entries: PendingOpEntry<string>[]): PendingOpState[] =>
  entries.map((e) => e.state)

describe('enqueue', () => {
  it('registers a minted op once and refuses duplicates without overwriting', () => {
    const ledger = createPendingOpLedger<string>()
    expect(ledger.enqueue('op-1', 'first-shadow')).toBe(true)
    expect(ledger.enqueue('op-1', 'second-shadow')).toBe(false)
    expect(ledger.get('op-1')).toEqual({
      opId: 'op-1',
      state: 'queued',
      shadow: 'first-shadow'
    })
    expect(ledger.size()).toBe(1)
  })

  it('refuses a duplicate id in every later state (id is never re-minted)', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1', 'op-2'])
    ledger.reconcileOpsResult({
      batch: ['op-1', 'op-2'],
      applied: ['op-1'],
      skipped: [],
      failedOpId: 'op-2'
    })
    expect(ledger.enqueue('op-1', 'again')).toBe(false)
    expect(ledger.enqueue('op-2', 'again')).toBe(false)
  })
})

describe('markInFlight', () => {
  it('transitions queued entries and reports unknown ids back', () => {
    const ledger = createPendingOpLedger<string>()
    ledger.enqueue('op-1', 's1')
    expect(ledger.markInFlight(['op-1', 'op-ghost'])).toEqual(['op-ghost'])
    expect(ledger.get('op-1')?.state).toBe('inflight')
  })

  it('allows a retry with the SAME id from failed and unprocessed states', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1', 'op-2', 'op-3'])
    ledger.reconcileOpsResult({
      batch: ['op-1', 'op-2', 'op-3'],
      applied: ['op-1'],
      skipped: [],
      failedOpId: 'op-2',
      failure: { code: 'invalid_node_payload' }
    })
    // Retry re-sends the rejected op and the never-processed suffix, same ids.
    expect(ledger.markInFlight(['op-2', 'op-3'])).toEqual([])
    expect(ledger.get('op-2')?.state).toBe('inflight')
    // The stale failure detail does not survive the retry.
    expect(ledger.get('op-2')?.failure).toBeUndefined()
    expect(ledger.get('op-3')?.state).toBe('inflight')
  })

  it('refuses to re-fly applied and skipped entries', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1', 'op-2'])
    ledger.reconcileOpsResult({
      batch: ['op-1', 'op-2'],
      applied: ['op-1'],
      skipped: ['op-2']
    })
    expect(ledger.markInFlight(['op-1', 'op-2'])).toEqual(['op-1', 'op-2'])
    expect(ledger.get('op-1')?.state).toBe('applied')
    expect(ledger.get('op-2')?.state).toBe('skipped')
  })
})

describe('reconcileOpsResult', () => {
  it('classifies applied prefix, failed op, and unprocessed suffix separately', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1', 'op-2', 'op-3', 'op-4'])
    const summary = reconcile(ledger, {
      batch: ['op-1', 'op-2', 'op-3', 'op-4'],
      applied: ['op-1', 'op-2'],
      skipped: [],
      failedOpId: 'op-3',
      failure: { code: 'invalid_node_payload', message: 'bad node' }
    })
    expect(summary).toEqual({
      applied: ['op-1', 'op-2'],
      skipped: [],
      failed: ['op-3'],
      unprocessed: ['op-4'],
      unknown: []
    })
    // ok:false did NOT roll anything back: every entry is still held.
    expect(ledger.size()).toBe(4)
    expect(ledger.get('op-1')?.state).toBe('applied')
    expect(ledger.get('op-2')?.state).toBe('applied')
    expect(ledger.get('op-3')).toEqual({
      opId: 'op-3',
      state: 'failed',
      shadow: 'shadow-op-3',
      failure: { code: 'invalid_node_payload', message: 'bad node' }
    })
    expect(ledger.get('op-4')?.state).toBe('unprocessed')
  })

  it('marks skipped ids as skipped, not applied and not removed', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1', 'op-2'])
    const summary = ledger.reconcileOpsResult({
      batch: ['op-1', 'op-2'],
      applied: ['op-1'],
      skipped: ['op-2']
    })
    expect(summary.skipped).toEqual(['op-2'])
    expect(ledger.get('op-2')?.state).toBe('skipped')
    // A fully duplicate batch never re-broadcasts, so the skipped entry stays
    // until explicit reconciliation (s3-opt-2 policy) — clearOnEffect for a
    // frame that never comes must not be the only exit.
    expect(ledger.entries('skipped')).toHaveLength(1)
  })

  it('reports ids the ledger does not hold as unknown instead of throwing', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1'])
    const summary = ledger.reconcileOpsResult({
      batch: ['op-1', 'op-foreign'],
      applied: ['op-1', 'op-foreign'],
      skipped: []
    })
    expect(summary.applied).toEqual(['op-1'])
    expect(summary.unknown).toEqual(['op-foreign'])
    expect(ledger.size()).toBe(1)
  })
})

describe('clearOnEffect (KA-9)', () => {
  it('preserves applied entries until the effect, then removes exactly those', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1', 'op-2', 'op-3'])
    ledger.reconcileOpsResult({
      batch: ['op-1', 'op-2', 'op-3'],
      applied: ['op-1', 'op-2'],
      skipped: [],
      failedOpId: 'op-3'
    })
    // Ack alone removed nothing (clear on effect, not on ack).
    expect(statesOf(ledger.entries())).toEqual(['applied', 'applied', 'failed'])

    const removed = ledger.clearOnEffect(['op-1', 'op-2'])
    expect(removed.map((e) => e.opId)).toEqual(['op-1', 'op-2'])
    expect(removed.map((e) => e.shadow)).toEqual(['shadow-op-1', 'shadow-op-2'])
    expect(ledger.size()).toBe(1)
    expect(ledger.get('op-3')?.state).toBe('failed')
  })

  it('clears an entry the ack never classified (lost result frame)', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1'])
    // The effect is authoritative even when doc_ops_result was lost.
    const removed = ledger.clearOnEffect(['op-1'])
    expect(removed).toHaveLength(1)
    expect(removed[0]!.state).toBe('inflight')
    expect(ledger.size()).toBe(0)
  })

  it('ignores effect ids it does not hold (remote actors share the doc)', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1'])
    expect(ledger.clearOnEffect(['op-remote'])).toEqual([])
    expect(ledger.size()).toBe(1)
  })
})

describe('take (explicit reconciliation)', () => {
  it('removes and returns one entry, once', () => {
    const ledger = createPendingOpLedger<string>()
    flownBatch(ledger, ['op-1'])
    ledger.reconcileOpsResult({
      batch: ['op-1'],
      applied: [],
      skipped: [],
      failedOpId: 'op-1',
      failure: 'rejected'
    })
    const entry = ledger.take('op-1')
    expect(entry).toEqual({
      opId: 'op-1',
      state: 'failed',
      shadow: 'shadow-op-1',
      failure: 'rejected'
    })
    expect(ledger.take('op-1')).toBeUndefined()
    expect(ledger.size()).toBe(0)
  })
})

describe('entries', () => {
  it('returns immutable-by-copy snapshots in insertion order, filterable by state', () => {
    const ledger = createPendingOpLedger<string>()
    ledger.enqueue('op-1', 's1')
    ledger.enqueue('op-2', 's2')
    ledger.markInFlight(['op-2'])
    expect(ledger.entries().map((e) => e.opId)).toEqual(['op-1', 'op-2'])
    expect(ledger.entries('queued').map((e) => e.opId)).toEqual(['op-1'])
    expect(ledger.entries('inflight').map((e) => e.opId)).toEqual(['op-2'])

    // Mutating a snapshot does not write through to the ledger.
    const snapshot = ledger.entries()[0]! as { state: string }
    snapshot.state = 'applied'
    expect(ledger.get('op-1')?.state).toBe('queued')
  })
})
