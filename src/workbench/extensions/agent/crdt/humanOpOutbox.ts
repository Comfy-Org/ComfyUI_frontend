/**
 * Human-op outbox (mutref-3 / M7 s1): the pure, store-backed record of every
 * locally minted human op from the moment it is minted until the host has
 * ruled on it. It exists so a batch that the sender retires WITHOUT a host
 * verdict (`undeliverable`, `unconfirmed`, `unacknowledged`) survives the
 * sender's in-memory lifetime — and, through the `OutboxStore` port, a page
 * reload — and can be replayed later with the SAME op ids.
 *
 * Contract boundaries this module deliberately encodes:
 *
 * - `op_id` is minted ONCE by the sender (`mintWireOps`) and never regenerated
 *   here. Replay hands back the original `Op` objects verbatim, so the host's
 *   `op_id` gate (KA-6) turns a replay of an op it already applied into a
 *   `no-op`, never a second effect. A re-record of an op id the outbox has
 *   already seen is refused for the same reason.
 * - The outbox never decides delivery: it records what was minted, applies
 *   the sender's terminal `BatchOutcome` per member, and exposes what is safe
 *   to replay. Wiring it to the sender (m7-s2) and driving replay (m7-s3) are
 *   separate slices; this module has no timers, no clocks, no IO of its own.
 * - Per-target isolation: entries are keyed by the workflow they were minted
 *   against and are only ever replayed toward that workflow. A follower that
 *   moved to another doc never carries a parked op across (FC-5).
 * - An op the host explicitly REJECTED is retained for diagnostics but is
 *   never replayable: the host has ruled, and re-sending the same op id would
 *   be refused as `op_id_reuse` anyway. Only members the host never ruled on
 *   are parked.
 * - Every mutation writes through to the store, so a crash between two calls
 *   loses at most the call in progress. On rehydration a `queued` entry (the
 *   page went away before its batch settled) becomes `parked`: whether the
 *   host applied it is unknown, and replay is idempotent.
 */
import type { Op } from '@comfyorg/comfy-multi-player'

import type { BatchOutcome } from './opSender'

/** Lifecycle of one outbox entry. All transitions are explicit caller calls. */
type OutboxEntryState =
  /** Minted and handed to the sender; no terminal outcome yet. */
  | 'queued'
  /** Retired without a host verdict; safe to replay toward its workflow. */
  | 'parked'
  /** Host ruled against this exact op; retained, never replayed. */
  | 'rejected'

export interface OutboxEntry {
  /** The workflow the op was minted against; replay never crosses it. */
  readonly workflowId: string
  /** The minted wire op, verbatim. `op.op_id` is the entry's identity. */
  readonly op: Op
  readonly state: OutboxEntryState
  /** Verbatim host failure detail; only present in the `rejected` state. */
  readonly failure?: unknown
}

/**
 * Persistence port. Synchronous and whole-list: the outbox is small (a few
 * batches at most) and correctness needs the write to have happened before
 * the next call, not a promise that it will.
 */
export interface OutboxStore {
  load(key: string): readonly OutboxEntry[] | null
  save(key: string, entries: readonly OutboxEntry[]): void
  clear(key: string): void
}

interface SettleSummary {
  /** Members the host applied or already held; removed from the outbox. */
  readonly removed: number
  /** Members the host rejected; retained, never replayable. */
  readonly rejected: number
  /** Members without a host verdict; now replayable. */
  readonly parked: number
  /** Outcome members the outbox never recorded (or already settled). */
  readonly unknown: number
}

export interface HumanOpOutbox {
  /**
   * Record one minted batch in mint order. Returns the number of entries
   * added; an op id the outbox has already seen (any state) is refused.
   */
  record(workflowId: string, ops: readonly Op[]): number
  /** Apply the sender's terminal verdict for one batch, member by member. */
  settle(workflowId: string, outcome: BatchOutcome): SettleSummary
  /** Parked entries for one workflow, in mint order. Never another workflow's. */
  replayable(workflowId: string): readonly OutboxEntry[]
  /**
   * Forget every queued and parked entry for one workflow (doc reset,
   * `abortAll`). Rejected entries stay for diagnostics. Returns the count.
   */
  drop(workflowId: string): number
  /** Every entry across all workflows, in record order. Diagnostics only. */
  entries(): readonly OutboxEntry[]
}

export function createMemoryOutboxStore(): OutboxStore {
  const slots = new Map<string, readonly OutboxEntry[]>()
  return {
    load: (key) => slots.get(key) ?? null,
    save(key, entries) {
      slots.set(key, [...entries])
    },
    clear(key) {
      slots.delete(key)
    }
  }
}

export function createHumanOpOutbox(deps: {
  store: OutboxStore
  key: string
}): HumanOpOutbox {
  const entries: OutboxEntry[] = rehydrate(deps.store.load(deps.key))

  function persist(): void {
    if (entries.length === 0) deps.store.clear(deps.key)
    else deps.store.save(deps.key, entries)
  }

  function indexOf(opId: string): number {
    return entries.findIndex((entry) => entry.op.op_id === opId)
  }

  function settle(workflowId: string, outcome: BatchOutcome): SettleSummary {
    const verdict = verdictOf(outcome)
    let removed = 0
    let rejected = 0
    let parked = 0
    let unknown = 0
    for (const op of outcome.ops) {
      const index = indexOf(op.op_id)
      if (index === -1) {
        unknown++
        continue
      }
      const entry = entries[index]
      if (entry.workflowId !== workflowId || entry.state !== 'queued') {
        unknown++
        continue
      }
      if (verdict.removed.has(op.op_id)) {
        entries.splice(index, 1)
        removed++
      } else if (verdict.rejected === op.op_id) {
        entries[index] = {
          ...entry,
          state: 'rejected',
          failure: verdict.failure
        }
        rejected++
      } else {
        entries[index] = { ...entry, state: 'parked' }
        parked++
      }
    }
    persist()
    return { removed, rejected, parked, unknown }
  }

  return {
    record(workflowId, ops) {
      let added = 0
      for (const op of ops) {
        if (indexOf(op.op_id) !== -1) continue
        entries.push({ workflowId, op, state: 'queued' })
        added++
      }
      if (added > 0) persist()
      return added
    },
    settle,
    replayable(workflowId) {
      return entries.filter(
        (entry) => entry.workflowId === workflowId && entry.state === 'parked'
      )
    },
    drop(workflowId) {
      const kept = entries.filter(
        (entry) => entry.workflowId !== workflowId || entry.state === 'rejected'
      )
      const dropped = entries.length - kept.length
      if (dropped > 0) {
        entries.splice(0, entries.length, ...kept)
        persist()
      }
      return dropped
    },
    entries: () => [...entries]
  }
}

/**
 * One batch verdict, member-addressable. Only an `acknowledged` outcome names
 * members: applied and skipped ids leave the outbox, the failure's op id is
 * rejected, and every other member — a member after the failure that the
 * host never processed, or any member of an anonymous failure — is parked.
 * The three verdict-less states park the whole batch.
 */
function verdictOf(outcome: BatchOutcome): {
  removed: ReadonlySet<string>
  rejected: string | undefined
  failure: unknown
} {
  if (outcome.state !== 'acknowledged') {
    return { removed: new Set(), rejected: undefined, failure: undefined }
  }
  const { result } = outcome
  return {
    removed: new Set([...result.applied, ...result.skipped]),
    rejected: result.failure?.op_id,
    failure: result.failure
  }
}

function rehydrate(stored: readonly OutboxEntry[] | null): OutboxEntry[] {
  if (!stored) return []
  return stored.map((entry) =>
    entry.state === 'queued' ? { ...entry, state: 'parked' } : { ...entry }
  )
}
