/**
 * Outcome-aware `doc_ops_result` reconciliation (s3-opt-2 / CRDT-RM-3): the
 * policy layer that turns one host acceptance frame into per-op transitions
 * over the pending ledger (s3-opt-1) and presentation shadow (s3-opt-5),
 * mapped against the exact batch the dispatcher (s3-opt-6) sent.
 *
 * Contract boundaries this module deliberately encodes:
 *
 * - `ok:false` NEVER means whole-batch rollback. The host applies the valid
 *   prefix, records the single failure, and still broadcasts; only the failed
 *   op and the truly unprocessed suffix are reverted here. Applied-prefix
 *   entries stay in the ledger (`applied` state) with their shadows visible
 *   until the matching authoritative EFFECT clears them (KA-9; the
 *   clear-on-effect wiring itself is s3-opt-3 and is NOT performed here).
 * - `skipped[]` means the op id already existed host-side, so a fully
 *   duplicate batch produces no new broadcast — a skipped shadow can never
 *   wait for an effect frame that will not come. It is also never cleared on
 *   the ack itself: removal happens only on an authoritative PROJECTION
 *   transition. Concretely, a skipped entry clears when the follower has
 *   projected doc state at or beyond the ack's `seq` — immediately at
 *   reconcile time when the projected seq already covers it, otherwise on the
 *   first subsequent projected `doc_update` whose seq covers it. When the ack
 *   carries no seq, the next projected authoritative transition of any seq
 *   clears it (the duplicate pre-existed the ack, so any later authoritative
 *   state contains it). Bounded by the follower's own gap machinery: a host
 *   seq above ours implies broadcasts exist and will be replayed.
 * - Results are validated, not trusted: a malformed frame (or one whose
 *   mentioned op ids match no unreconciled sent batch) changes nothing and
 *   reports `matched:false`. Each sent batch reconciles at most once, so a
 *   redelivered result cannot double-revert.
 * - No Yjs, no canvas, no timers, no IO: every transition is an explicit
 *   call, and the only collaborators are the injected ledger and shadow.
 */
import type { SentBatch } from './humanOpDispatcher'
import type { PendingOpLedger } from './pendingOpLedger'
import type { PendingOpShadowSurface } from './pendingOpShadow'

/** What one reconciliation pass did, for observability and tests. */
export interface OpsResultReport {
  /** False when the frame was malformed or matched no unreconciled batch. */
  matched: boolean
  /** The sent batch's op ids, in submitted order (empty when unmatched). */
  batch: readonly string[]
  /** Applied-prefix ids kept pending until their effect (never rolled back). */
  appliedKept: readonly string[]
  /** Failed op + unprocessed suffix: shadows reverted, ledger entries taken. */
  rolledBack: readonly string[]
  /** Skipped duplicates now awaiting an authoritative projection transition. */
  skippedAwaiting: readonly string[]
  /** Skipped duplicates cleared because projected state already covers them. */
  skippedCleared: readonly string[]
  /** Ids the result mentioned that the ledger does not hold. */
  unknown: readonly string[]
}

export interface OpsResultReconciler {
  /**
   * Consume one `doc_ops_result` frame against the as-sent batches. The frame
   * is validated structurally; on any malformation this is a recorded no-op.
   */
  reconcile(result: unknown, sentBatches: readonly SentBatch[]): OpsResultReport
  /**
   * The follower projected authoritative doc state at `seq` (null when the
   * update carried no usable seq). Clears every awaiting skipped entry whose
   * ack seq is covered — this, not the ack, is the removal trigger.
   * Returns the cleared op ids.
   */
  onAuthoritativeState(seq: number | null): string[]
  /** Drop all reconciliation bookkeeping (doc_reset / unmount, FEB-5). */
  reset(): void
}

interface ParsedResult {
  applied: readonly string[]
  skipped: readonly string[]
  failedOpId: string | null
  failure: unknown
  seq: number | null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/** Tolerant parse mirroring docFrameClient's stance: malformed → null. */
function parseResult(value: unknown): ParsedResult | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.ok !== 'boolean') return null
  const failed = record.failed
  let failedOpId: string | null = null
  if (typeof failed === 'object' && failed !== null) {
    const id = (failed as Record<string, unknown>).op_id
    if (typeof id === 'string') failedOpId = id
  }
  return {
    applied: stringArray(record.applied),
    skipped: stringArray(record.skipped),
    failedOpId,
    failure: failed ?? undefined,
    seq: typeof record.seq === 'number' ? record.seq : null
  }
}

const batchKey = (opIds: readonly string[]): string => opIds.join('\u0000')

export function createOpsResultReconciler(deps: {
  ledger: PendingOpLedger<unknown>
  shadow: PendingOpShadowSurface
  /** The highest seq the follower has PROJECTED (not merely been acked). */
  currentSeq: () => number
}): OpsResultReconciler {
  const { ledger, shadow, currentSeq } = deps
  /** Skipped op id → the ack seq that must be projected before clearing. */
  const awaitingSkipped = new Map<string, number | null>()
  /** Batches already reconciled; a redelivered result must not re-transition. */
  const reconciledBatches = new Set<string>()

  const unmatched = (unknown: readonly string[]): OpsResultReport => ({
    matched: false,
    batch: [],
    appliedKept: [],
    rolledBack: [],
    skippedAwaiting: [],
    skippedCleared: [],
    unknown
  })

  const clearSkipped = (opId: string): void => {
    // `clear`, not `revert`: the authoritative state already contains the
    // duplicate's outcome, so pending styling RESOLVES rather than rolls back.
    shadow.clear(opId)
    ledger.take(opId)
  }

  return {
    reconcile(result, sentBatches) {
      const parsed = parseResult(result)
      if (parsed === null) return unmatched([])

      const mentioned = new Set([...parsed.applied, ...parsed.skipped])
      if (parsed.failedOpId !== null) mentioned.add(parsed.failedOpId)

      let batch: readonly string[] | null = null
      for (const sent of sentBatches) {
        const key = batchKey(sent.opIds)
        if (reconciledBatches.has(key)) continue
        if (!sent.opIds.some((opId) => mentioned.has(opId))) continue
        reconciledBatches.add(key)
        batch = sent.opIds
        break
      }
      if (batch === null) return unmatched([...mentioned])

      const summary = ledger.reconcileOpsResult({
        batch,
        applied: parsed.applied,
        skipped: parsed.skipped,
        failedOpId: parsed.failedOpId,
        failure: parsed.failure
      })

      // Failed op + unprocessed suffix: roll back. The suffix was never
      // processed by the host and typically depends on the failed op (the
      // host aborts the remainder at the first rejection), so re-driving it
      // without its predecessor would replay a broken intent. The user's
      // canvas returns to the authoritative state; re-doing is explicit.
      const rolledBack: string[] = []
      for (const opId of [...summary.failed, ...summary.unprocessed]) {
        shadow.revert(opId)
        ledger.take(opId)
        rolledBack.push(opId)
      }

      const skippedAwaiting: string[] = []
      const skippedCleared: string[] = []
      const projectedSeq = currentSeq()
      for (const opId of summary.skipped) {
        if (parsed.seq !== null && projectedSeq >= parsed.seq) {
          // The projection has already folded doc state at/after the ack, so
          // the duplicate's authoritative outcome is on screen NOW. This is a
          // projection-based transition, not a clear-on-ack.
          clearSkipped(opId)
          skippedCleared.push(opId)
        } else {
          awaitingSkipped.set(opId, parsed.seq)
          skippedAwaiting.push(opId)
        }
      }

      return {
        matched: true,
        batch,
        appliedKept: summary.applied,
        rolledBack,
        skippedAwaiting,
        skippedCleared,
        unknown: summary.unknown
      }
    },

    onAuthoritativeState(seq) {
      if (awaitingSkipped.size === 0) return []
      const cleared: string[] = []
      for (const [opId, requiredSeq] of awaitingSkipped) {
        // A null requiredSeq (ack carried no seq) is satisfied by ANY later
        // authoritative transition; a null seq (update carried no usable seq)
        // still proves a transition happened, which is all a null requirement
        // needs — but cannot prove coverage of a numbered requirement.
        const covered =
          requiredSeq === null || (seq !== null && seq >= requiredSeq)
        if (!covered) continue
        awaitingSkipped.delete(opId)
        clearSkipped(opId)
        cleared.push(opId)
      }
      return cleared
    },

    reset() {
      awaitingSkipped.clear()
      reconciledBatches.clear()
    }
  }
}
