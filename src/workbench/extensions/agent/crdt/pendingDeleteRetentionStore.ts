/**
 * Owns retained human-delete intent at a scope wider than any single
 * follower instance; see ADR CRDT-WRITE-0035 for why, and for the retention
 * state machine this module implements.
 */
import { STALE_AFTER_MS } from './agentCrdtDocLifecycle'
import type { BatchOutcome } from './opSender'

const PENDING_DELETE_EXPIRY_MS = STALE_AFTER_MS

/**
 * Retention policy per reason (ADR CRDT-WRITE-0035):
 * - `confirmed-applied`: a known Yjs item was deleted and the host confirmed
 *   it. No expiry - superseded only by a different item later occupying the
 *   node id.
 * - `confirmed-applied-unidentified`: the host confirmed the delete, but no
 *   item identity was captured for it (the node did not yet exist in the
 *   follower doc at admission time, e.g. a local-only add). With no identity
 *   to compare against a later occupant, this is bounded by the same expiry
 *   as `unknown` instead of held forever.
 * - `unknown`: the batch's own outcome was inconclusive. Bounded by expiry.
 */
type RetainedDelete =
  | { reason: 'confirmed-applied'; deletedItemId: string }
  | { reason: 'confirmed-applied-unidentified'; expiresAt: number }
  | { reason: 'unknown'; expiresAt: number; deletedItemId: string | null }

type RetentionReason = 'confirmed-applied' | 'unknown'

/** The captured identity `retained` names, or null when it carries none to compare against (bounded instead). */
function deletedItemIdOf(retained: RetainedDelete): string | null {
  return retained.reason === 'confirmed-applied-unidentified'
    ? null
    : retained.deletedItemId
}

/** The expiry `retained` names, or null when it has none (permanent until superseded or released). */
function expiresAtOf(retained: RetainedDelete): number | null {
  return retained.reason === 'confirmed-applied' ? null : retained.expiresAt
}

function retentionStrength(reason: RetainedDelete['reason']): number {
  if (reason === 'confirmed-applied') return 2
  if (reason === 'confirmed-applied-unidentified') return 1
  return 0
}

/** A concrete identity mismatch between the two names a later incarnation under the same node id; either side lacking an identity to compare is inconclusive, not a mismatch. */
function identitiesConflict(
  existing: RetainedDelete,
  incoming: RetainedDelete
): boolean {
  const existingId = deletedItemIdOf(existing)
  const incomingId = deletedItemIdOf(incoming)
  return existingId !== null && incomingId !== null && existingId !== incomingId
}

/** The stronger of the two, assuming no identity conflict: the stronger reason wins, and between two equally strong (both bounded) records the later expiry wins. */
function strongerRetainedDelete(
  existing: RetainedDelete,
  incoming: RetainedDelete
): RetainedDelete {
  const existingStrength = retentionStrength(existing.reason)
  const incomingStrength = retentionStrength(incoming.reason)
  if (incomingStrength !== existingStrength)
    return incomingStrength > existingStrength ? incoming : existing
  if (existing.reason === 'confirmed-applied') return existing
  const existingExpiry = expiresAtOf(existing)
  const incomingExpiry = expiresAtOf(incoming)
  if (existingExpiry === null || incomingExpiry === null) return incoming
  return incomingExpiry < existingExpiry ? existing : incoming
}

/** Merges a newly settled retention into any existing record for the same node id. */
function mergeRetainedDelete(
  existing: RetainedDelete | undefined,
  incoming: RetainedDelete
): RetainedDelete {
  if (!existing) return incoming
  if (identitiesConflict(existing, incoming)) return incoming
  return strongerRetainedDelete(existing, incoming)
}

/** The retention reason a settled `delete_node` op's own outcome names, or `null` when it does not retain (skipped, undeliverable). */
function retentionReason(
  outcome: BatchOutcome,
  opId: string
): RetentionReason | null {
  if (outcome.state === 'acknowledged')
    return outcome.result.applied.includes(opId) ? 'confirmed-applied' : null
  if (outcome.state === 'unconfirmed' || outcome.state === 'unacknowledged')
    return 'unknown'
  return null
}

function buildRetainedDelete(
  reason: RetentionReason,
  deletedItemId: string | null
): RetainedDelete {
  if (reason === 'confirmed-applied' && deletedItemId !== null)
    return { reason, deletedItemId }
  return reason === 'confirmed-applied'
    ? {
        reason: 'confirmed-applied-unidentified',
        expiresAt: Date.now() + PENDING_DELETE_EXPIRY_MS
      }
    : {
        reason,
        expiresAt: Date.now() + PENDING_DELETE_EXPIRY_MS,
        deletedItemId
      }
}

/** Every `delete_node` op in a settled batch that must keep suppressing its node, paired with the `RetainedDelete` record to store for it. */
function retainedDeletesFromBatch(
  outcome: BatchOutcome
): Array<[nodeId: string, record: RetainedDelete]> {
  const retained: Array<[string, RetainedDelete]> = []
  for (const op of outcome.ops) {
    if (op.op !== 'delete_node') continue
    const reason = retentionReason(outcome, op.op_id)
    if (!reason) continue
    const deletedItemId = outcome.deletedItemIds.get(op.op_id) ?? null
    retained.push([
      String(op.node_id),
      buildRetainedDelete(reason, deletedItemId)
    ])
  }
  return retained
}

/** Prunes one workflow's released retained deletes in place. */
function pruneWorkflowDeletes(
  deletes: Map<string, RetainedDelete>,
  docNodeIds: ReadonlySet<string>,
  currentItemId: (nodeId: string) => string | null
): void {
  const now = Date.now()
  for (const [id, retained] of deletes) {
    const expiresAt = expiresAtOf(retained)
    const expired = expiresAt !== null && now >= expiresAt
    const deletedItemId = deletedItemIdOf(retained)
    const superseded =
      deletedItemId !== null && currentItemId(id) !== deletedItemId
    if (!docNodeIds.has(id) || superseded || expired) deletes.delete(id)
  }
}

export interface PendingDeleteRetentionStore {
  /** Registers a settled batch's delete_node outcomes, merging with any existing retention for the same node/item. */
  settleBatch(outcome: BatchOutcome): void
  /** Every node id in `workflowId` a lagging reconcile must not resurrect, pruned against the live doc first. */
  retainedNodeIds(
    workflowId: string,
    docNodeIds: ReadonlySet<string>,
    currentItemId: (nodeId: string) => string | null
  ): ReadonlySet<string>
  /** Drops one workflow's retained deletes (`doc_reset`). */
  clearWorkflow(workflowId: string): void
}

export function createPendingDeleteRetentionStore(): PendingDeleteRetentionStore {
  const confirmedDeletes = new Map<string, Map<string, RetainedDelete>>()

  return {
    settleBatch(outcome) {
      if (outcome.workflowId === null) return
      const workflowId = outcome.workflowId
      const retained = retainedDeletesFromBatch(outcome)
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
