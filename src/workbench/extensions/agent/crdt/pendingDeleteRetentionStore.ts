/**
 * Owns retained human-delete intent (ADR CRDT-WRITE-0035) at a scope wider
 * than any single follower instance; see the ADR for why and for the
 * retention state machine this module implements.
 */
import { reportError } from '@/platform/telemetry/reportError'

import { STALE_AFTER_MS } from './agentCrdtDocLifecycle'
import type { BatchOutcome } from './opSender'

/** Only a `'unknown'`-reason retention expires; see ADR CRDT-WRITE-0035. */
const PENDING_DELETE_EXPIRY_MS = STALE_AFTER_MS

/** Retention policy per reason: see ADR CRDT-WRITE-0035. */
type RetainedDelete =
  | { reason: 'confirmed-applied'; deletedItemId: string | null }
  | { reason: 'unknown'; expiresAt: number; deletedItemId: string | null }

/** One `captureDeleteIntent` call awaiting the terminal outcome of its op. */
interface PendingCapture {
  nodeId: string
  itemId: string | null
}

/**
 * Merges a newly settled retention into any existing record for the same
 * node id, but only when both describe the same Yjs item: a node id whose
 * `deletedItemId` differs from the stored record's names a later incarnation
 * under the old id, which needs its own retention decision rather than a
 * strength comparison against a record for a different item. For the same
 * item, `'confirmed-applied'` always wins over `'unknown'`, and between two
 * `'unknown'` records the later expiry wins.
 */
function mergeRetainedDelete(
  existing: RetainedDelete | undefined,
  incoming: RetainedDelete
): RetainedDelete {
  if (!existing || existing.deletedItemId !== incoming.deletedItemId)
    return incoming
  if (existing.reason === 'confirmed-applied') return existing
  if (incoming.reason === 'confirmed-applied') return incoming
  return incoming.expiresAt >= existing.expiresAt ? incoming : existing
}

/** The retention reason a settled `delete_node` op's own outcome names, or `null` when it does not retain (skipped, undeliverable). */
function retentionReason(
  outcome: BatchOutcome,
  opId: string
): RetainedDelete['reason'] | null {
  if (outcome.state === 'acknowledged')
    return outcome.result.applied.includes(opId) ? 'confirmed-applied' : null
  if (outcome.state === 'unconfirmed' || outcome.state === 'unacknowledged')
    return 'unknown'
  return null
}

/**
 * Consumes and returns `nodeId`'s own captured identity, one FIFO slot per
 * `delete_node` op regardless of its outcome - see
 * {@link retainedDeletesFromBatch}. A capture whose node id does not match
 * `nodeId` means the FIFO invariant this depends on broke; reported and
 * treated as no capture rather than trusted.
 */
function consumeDeletedItemId(
  workflowId: string | null,
  nodeId: string,
  consumeNextCapture: (workflowId: string) => PendingCapture | undefined
): string | null {
  const capture =
    workflowId === null ? undefined : consumeNextCapture(workflowId)
  if (!capture) return null
  if (capture.nodeId !== nodeId) {
    reportError(
      new Error('pending delete capture order does not match its op'),
      { errorType: 'failure_matching_agent_pending_delete_capture' }
    )
    return null
  }
  return capture.itemId
}

function buildRetainedDelete(
  reason: RetainedDelete['reason'],
  deletedItemId: string | null
): RetainedDelete {
  return reason === 'unknown'
    ? {
        reason,
        expiresAt: Date.now() + PENDING_DELETE_EXPIRY_MS,
        deletedItemId
      }
    : { reason, deletedItemId }
}

/**
 * Every `delete_node` op in a settled batch that must keep suppressing its
 * node, paired with the `RetainedDelete` record to store for it.
 * `consumeNextCapture` is called for every `delete_node` op in the batch,
 * including one whose outcome does not retain (skipped, or undeliverable) -
 * a capture is a one-shot slot for exactly one minted op, and an outcome that
 * does not consume its own slot leaves it to be wrongly consumed by whatever
 * later op happens to ask next.
 */
function retainedDeletesFromBatch(
  outcome: BatchOutcome,
  consumeNextCapture: (workflowId: string) => PendingCapture | undefined
): Array<[nodeId: string, record: RetainedDelete]> {
  const retained: Array<[string, RetainedDelete]> = []
  for (const op of outcome.ops) {
    if (op.op !== 'delete_node') continue
    const nodeId = String(op.node_id)
    const deletedItemId = consumeDeletedItemId(
      outcome.workflowId,
      nodeId,
      consumeNextCapture
    )
    const reason = retentionReason(outcome, op.op_id)
    if (reason)
      retained.push([nodeId, buildRetainedDelete(reason, deletedItemId)])
  }
  return retained
}

/** Prunes one workflow's released retained deletes in place (ADR CRDT-WRITE-0035). */
function pruneWorkflowDeletes(
  deletes: Map<string, RetainedDelete>,
  docNodeIds: ReadonlySet<string>,
  currentItemId: (nodeId: string) => string | null
): void {
  const now = Date.now()
  for (const [id, retained] of deletes) {
    const expired = retained.reason === 'unknown' && now >= retained.expiresAt
    const superseded =
      retained.deletedItemId !== null &&
      currentItemId(id) !== retained.deletedItemId
    if (!docNodeIds.has(id) || superseded || expired) deletes.delete(id)
  }
}

export interface PendingDeleteRetentionStore {
  /**
   * Captures the item identity `nodeId` currently names, at the moment a
   * human `delete_node` op for it is issued - before the op reaches the
   * wire and before any doc_update can react to it. Capturing here, rather
   * than inferring the deleted identity from a later doc-diff, is what
   * keeps a same-tick atomic delete-and-recreate in one Yjs transaction
   * (which never appears as a `removed` id in that diff) from being
   * attributed to the wrong incarnation. Queued FIFO per workflow: a
   * recreate-then-delete admitted before an earlier delete's own result
   * settles gets its own slot instead of overwriting the earlier one's.
   */
  captureDeleteIntent(
    workflowId: string,
    nodeId: string,
    itemId: string | null
  ): void
  /** Registers a settled batch's delete_node outcomes, merging with any existing retention for the same node/item. */
  settleBatch(outcome: BatchOutcome): void
  /** Every node id in `workflowId` a lagging reconcile must not resurrect, pruned against the live doc first. */
  retainedNodeIds(
    workflowId: string,
    docNodeIds: ReadonlySet<string>,
    currentItemId: (nodeId: string) => string | null
  ): ReadonlySet<string>
  /** Drops one workflow's retained deletes and unconsumed capture buffer - `doc_reset` / `follower_replaced`. */
  clearWorkflow(workflowId: string): void
}

export function createPendingDeleteRetentionStore(): PendingDeleteRetentionStore {
  const confirmedDeletes = new Map<string, Map<string, RetainedDelete>>()
  const pendingCaptures = new Map<string, PendingCapture[]>()

  function captureQueueFor(workflowId: string): PendingCapture[] {
    let captures = pendingCaptures.get(workflowId)
    if (!captures) {
      captures = []
      pendingCaptures.set(workflowId, captures)
    }
    return captures
  }

  function consumeNextCapture(workflowId: string): PendingCapture | undefined {
    const captures = pendingCaptures.get(workflowId)
    if (!captures || captures.length === 0) return undefined
    const capture = captures.shift()
    if (captures.length === 0) pendingCaptures.delete(workflowId)
    return capture
  }

  return {
    captureDeleteIntent(workflowId, nodeId, itemId) {
      captureQueueFor(workflowId).push({ nodeId, itemId })
    },
    settleBatch(outcome) {
      if (outcome.workflowId === null) return
      const workflowId = outcome.workflowId
      const retained = retainedDeletesFromBatch(outcome, consumeNextCapture)
      if (retained.length === 0) return
      let deletes = confirmedDeletes.get(workflowId)
      if (!deletes) {
        deletes = new Map()
        confirmedDeletes.set(workflowId, deletes)
      }
      for (const [nodeId, record] of retained)
        deletes.set(nodeId, mergeRetainedDelete(deletes.get(nodeId), record))
    },
    retainedNodeIds(workflowId, docNodeIds, currentItemId) {
      const deletes = confirmedDeletes.get(workflowId)
      if (!deletes) return new Set()
      pruneWorkflowDeletes(deletes, docNodeIds, currentItemId)
      if (deletes.size === 0) {
        confirmedDeletes.delete(workflowId)
        return new Set()
      }
      return new Set(deletes.keys())
    },
    clearWorkflow(workflowId) {
      confirmedDeletes.delete(workflowId)
      pendingCaptures.delete(workflowId)
    }
  }
}

/**
 * The production owner: one instance per page load, shared across every
 * `useAgentCrdtFollower` call so retention survives a follower being
 * disposed and a new one mounted for the same workflow. Tests inject their
 * own instance via {@link createPendingDeleteRetentionStore} so state never
 * leaks between cases.
 */
export const sharedPendingDeleteRetentionStore: PendingDeleteRetentionStore =
  createPendingDeleteRetentionStore()
