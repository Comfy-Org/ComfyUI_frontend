/**
 * Owns retained human-delete intent at a scope wider than any single
 * follower instance; see ADR CRDT-WRITE-0035 for why, and for the retention
 * state machine this module implements. The input shape below is this
 * store's own contract - it names no sender/transport type, so a future
 * transport can feed it without fabricating one.
 */
import { STALE_AFTER_MS } from './agentCrdtDocLifecycle'

const PENDING_DELETE_EXPIRY_MS = STALE_AFTER_MS

/** A settled `delete_node`'s outcome, as this store needs it. */
export type RetentionReason = 'confirmed-applied' | 'unknown'

/** One node's settled delete, ready to register with {@link PendingDeleteRetentionStore.settleBatch}. */
export interface RetainedDeleteCandidate {
  workflowId: string
  nodeId: string
  reason: RetentionReason
  /** The Yjs item identity captured at admission time, or null when none was captured. */
  identity: string | null
}

type RetainedDelete =
  | { reason: 'confirmed-applied'; deletedItemId: string }
  | { reason: 'confirmed-applied-unidentified'; expiresAt: number }
  | { reason: 'unknown'; expiresAt: number; deletedItemId: string | null }

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

/**
 * Two records naming the same real identity (or both naming none) are the
 * same releasable intent and may collapse into one; anything else is
 * independent and must be tracked as its own entry (see
 * {@link insertRetainedDelete}).
 */
function sameIdentityBucket(a: RetainedDelete, b: RetainedDelete): boolean {
  return deletedItemIdOf(a) === deletedItemIdOf(b)
}

/**
 * The record to keep when both name the same identity bucket (verified by
 * the caller via {@link sameIdentityBucket}). A permanent record (an
 * identified `confirmed-applied`) always outranks a bounded one for the same
 * identity, since only {@link pruneWorkflowDeletes}'s own two release
 * conditions ever drop it, never a sooner expiry. Between two bounded
 * records for the same bucket, the one whose own expiry is later - whichever
 * intent's window is open longest - wins, preserving the longer deadline.
 */
function mergeSameIdentityDelete(
  existing: RetainedDelete,
  incoming: RetainedDelete
): RetainedDelete {
  const existingExpiry = expiresAtOf(existing)
  const incomingExpiry = expiresAtOf(incoming)
  if (existingExpiry === null) return existing
  if (incomingExpiry === null) return incoming
  return incomingExpiry >= existingExpiry ? incoming : existing
}

/**
 * Inserts a newly settled retention into the node's existing records.
 *
 * A record naming the same identity bucket as `incoming` (see
 * {@link sameIdentityBucket}) merges with it via
 * {@link mergeSameIdentityDelete}. A record naming a DIFFERENT, real
 * identity than `incoming`'s is dropped: the node has moved on to a newer
 * known incarnation, and the old identity can never reoccupy it. A record
 * naming no identity at all is independent of `incoming` either way (an
 * identity-less intent can be about any incarnation, so no known identity
 * can safely rule it superseded) and is kept untouched alongside it - this
 * is what lets a permanent, identified record and a bounded, unidentified
 * record for the same node id each survive on their own terms, in either
 * settlement order.
 */
function insertRetainedDelete(
  existingRecords: readonly RetainedDelete[],
  incoming: RetainedDelete
): RetainedDelete[] {
  const kept: RetainedDelete[] = []
  let merged = false
  for (const record of existingRecords) {
    if (sameIdentityBucket(record, incoming)) {
      kept.push(mergeSameIdentityDelete(record, incoming))
      merged = true
    } else if (
      deletedItemIdOf(record) === null ||
      deletedItemIdOf(incoming) === null
    ) {
      kept.push(record)
    }
    // else: both name a real, different identity - drop `record`.
  }
  if (!merged) kept.push(incoming)
  return kept
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

/**
 * Prunes one workflow's released retained deletes in place, dropping only
 * the specific records whose own identity is confirmed-superseded or whose
 * own expiry has passed - never a node id's whole record set on account of
 * just one of possibly several independent records for it (see
 * {@link insertRetainedDelete}). A record is released by either: (1) the
 * document no longer containing the node at all, or (2) a different real
 * identity now occupying its id. Condition (1) only applies when
 * `docNodeIds` is itself `authoritative` - a transient read of a document
 * that has not caught up yet (e.g. a just-reminted, still-empty replacement;
 * see ADR CRDT-WRITE-0035) proves nothing, and must not drop a record that a
 * later, authoritative read would still need.
 */
function pruneWorkflowDeletes(
  deletes: Map<string, RetainedDelete[]>,
  docNodeIds: ReadonlySet<string>,
  currentItemId: (nodeId: string) => string | null,
  authoritative: boolean
): void {
  const now = Date.now()
  for (const [id, records] of deletes) {
    if (authoritative && !docNodeIds.has(id)) {
      deletes.delete(id)
      continue
    }
    const currentId = currentItemId(id)
    const remaining = records.filter((retained) => {
      const expiresAt = expiresAtOf(retained)
      const expired = expiresAt !== null && now >= expiresAt
      const deletedItemId = deletedItemIdOf(retained)
      // A null current identity is an unreadable read (internal Yjs-shape
      // failure) or no live doc to read from - never proof a different
      // item replaced this one. Only a real, differing identity supersedes.
      const superseded =
        deletedItemId !== null &&
        currentId !== null &&
        currentId !== deletedItemId
      return !superseded && !expired
    })
    if (remaining.length === 0) deletes.delete(id)
    else deletes.set(id, remaining)
  }
}

export interface PendingDeleteRetentionStore {
  /** Registers settled delete_node outcomes, merging with any existing retention for the same node/identity. */
  settleBatch(candidates: readonly RetainedDeleteCandidate[]): void
  /**
   * Every node id in `workflowId` a lagging reconcile must not resurrect,
   * pruned against `docNodeIds` first. `authoritative` must be false for a
   * `docNodeIds` read from a document that has not caught up since its last
   * replacement (see {@link pruneWorkflowDeletes}); passing true for such a
   * read can permanently and incorrectly drop a still-needed retention.
   */
  retainedNodeIds(
    workflowId: string,
    docNodeIds: ReadonlySet<string>,
    currentItemId: (nodeId: string) => string | null,
    authoritative: boolean
  ): ReadonlySet<string>
  /** Drops one workflow's retained deletes (`doc_reset`). */
  clearWorkflow(workflowId: string): void
}

export function createPendingDeleteRetentionStore(): PendingDeleteRetentionStore {
  const confirmedDeletes = new Map<string, Map<string, RetainedDelete[]>>()

  return {
    settleBatch(candidates) {
      for (const candidate of candidates) {
        let deletes = confirmedDeletes.get(candidate.workflowId)
        if (!deletes) {
          deletes = new Map()
          confirmedDeletes.set(candidate.workflowId, deletes)
        }
        const record = buildRetainedDelete(candidate.reason, candidate.identity)
        deletes.set(
          candidate.nodeId,
          insertRetainedDelete(deletes.get(candidate.nodeId) ?? [], record)
        )
      }
    },
    retainedNodeIds(workflowId, docNodeIds, currentItemId, authoritative) {
      const deletes = confirmedDeletes.get(workflowId)
      if (!deletes) return new Set()
      pruneWorkflowDeletes(deletes, docNodeIds, currentItemId, authoritative)
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
