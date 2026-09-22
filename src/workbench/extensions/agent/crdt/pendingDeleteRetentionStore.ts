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

type RetainedIdentified =
  | { reason: 'confirmed-applied'; deletedItemId: string }
  | { reason: 'unknown'; expiresAt: number; deletedItemId: string }

type RetainedUnidentified =
  | { reason: 'confirmed-applied-unidentified'; expiresAt: number }
  | { reason: 'unknown'; expiresAt: number }

/**
 * A node id names at most one identified fact and one unidentified fact at
 * once: a settle either names a real identity (merging into `identified`,
 * see {@link insertRetainedDelete}) or names none (merging into
 * `unidentified`), and the two never interact. This record makes that
 * invariant the type itself, rather than an array a caller could put an
 * arbitrary number of entries into.
 */
interface RetainedDeleteSlot {
  identified: RetainedIdentified | null
  unidentified: RetainedUnidentified | null
}

function identifiedExpiryOf(retained: RetainedIdentified): number | null {
  return retained.reason === 'confirmed-applied' ? null : retained.expiresAt
}

/**
 * The identified record to keep when both name the same `deletedItemId`: a
 * permanent record (confirmed-applied) has no expiry to lose by, so it
 * always outranks a bounded one; between two bounded records, the later
 * expiry wins.
 */
function strongerIdentified(
  existing: RetainedIdentified,
  incoming: RetainedIdentified
): RetainedIdentified {
  const existingExpiry = identifiedExpiryOf(existing)
  const incomingExpiry = identifiedExpiryOf(incoming)
  if (existingExpiry === null) return existing
  if (incomingExpiry === null) return incoming
  return incomingExpiry >= existingExpiry ? incoming : existing
}

function buildIdentified(
  reason: RetentionReason,
  deletedItemId: string
): RetainedIdentified {
  return reason === 'confirmed-applied'
    ? { reason, deletedItemId }
    : {
        reason,
        expiresAt: Date.now() + PENDING_DELETE_EXPIRY_MS,
        deletedItemId
      }
}

function buildUnidentified(reason: RetentionReason): RetainedUnidentified {
  return {
    reason:
      reason === 'confirmed-applied'
        ? 'confirmed-applied-unidentified'
        : reason,
    expiresAt: Date.now() + PENDING_DELETE_EXPIRY_MS
  }
}

function strongerUnidentified(
  existing: RetainedUnidentified,
  incoming: RetainedUnidentified
): RetainedUnidentified {
  return incoming.expiresAt >= existing.expiresAt ? incoming : existing
}

/**
 * Merges a newly settled retention into a node's slot.
 *
 * A settle naming a real identity replaces `slot.identified` outright unless
 * it names the SAME identity already there, in which case the two merge via
 * {@link strongerIdentified} - a different real identity means the node has
 * moved on to a newer known incarnation, and the old one can never reoccupy
 * it. A settle naming no identity always merges into `slot.unidentified`: an
 * identity-less intent could be about any incarnation, so it is independent
 * of whatever `slot.identified` holds and never disturbs it. This is what
 * lets a permanent, identified record and a bounded, unidentified record for
 * the same node id each survive on their own terms, in either settlement
 * order.
 */
function insertRetainedDelete(
  slot: RetainedDeleteSlot,
  reason: RetentionReason,
  deletedItemId: string | null
): RetainedDeleteSlot {
  if (deletedItemId === null) {
    const incoming = buildUnidentified(reason)
    return {
      identified: slot.identified,
      unidentified:
        slot.unidentified === null
          ? incoming
          : strongerUnidentified(slot.unidentified, incoming)
    }
  }
  const incoming = buildIdentified(reason, deletedItemId)
  const identified =
    slot.identified !== null && slot.identified.deletedItemId === deletedItemId
      ? strongerIdentified(slot.identified, incoming)
      : incoming
  return { identified, unidentified: slot.unidentified }
}

/**
 * `identified` is released by either a different real identity now
 * occupying the id, or its own expiry (a permanent `confirmed-applied` has
 * none).
 */
function pruneIdentified(
  identified: RetainedIdentified,
  currentId: string | null,
  now: number
): RetainedIdentified | null {
  const expiresAt = identifiedExpiryOf(identified)
  const expired = expiresAt !== null && now >= expiresAt
  // A null current identity is an unreadable read (internal Yjs-shape
  // failure) or no live doc to read from - never proof a different item
  // replaced this one. Only a real, differing identity supersedes.
  const superseded =
    currentId !== null && currentId !== identified.deletedItemId
  return expired || superseded ? null : identified
}

/** `unidentified` is released only by its own expiry - it has no identity to be superseded by. */
function pruneUnidentified(
  unidentified: RetainedUnidentified | null,
  now: number
): RetainedUnidentified | null {
  return unidentified !== null && now >= unidentified.expiresAt
    ? null
    : unidentified
}

/**
 * Prunes one workflow's released retained deletes in place, dropping only
 * the specific fact - `identified`, `unidentified`, or both - whose own
 * release condition is met, never a node id's whole slot on account of just
 * one (see {@link insertRetainedDelete}). Absence - the document no longer
 * containing the node at all - releases both, but only when `docNodeIds` is
 * itself `authoritative`: a transient read of a document that has not
 * caught up yet (e.g. a just-reminted, still-empty replacement; see ADR
 * CRDT-WRITE-0035) proves nothing, and must not drop a slot a later,
 * authoritative read would still need.
 */
function pruneWorkflowDeletes(
  deletes: Map<string, RetainedDeleteSlot>,
  docNodeIds: ReadonlySet<string>,
  currentItemId: (nodeId: string) => string | null,
  authoritative: boolean
): void {
  const now = Date.now()
  for (const [id, slot] of deletes) {
    if (authoritative && !docNodeIds.has(id)) {
      deletes.delete(id)
      continue
    }
    const identified =
      slot.identified === null
        ? null
        : pruneIdentified(slot.identified, currentItemId(id), now)
    const unidentified = pruneUnidentified(slot.unidentified, now)
    if (identified === null && unidentified === null) deletes.delete(id)
    else deletes.set(id, { identified, unidentified })
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
  /**
   * Drops every workflow's retained deletes. For the shared, page-lifetime
   * instance, its owner calls this on an identity or workspace teardown (see
   * {@link sharedPendingDeleteRetentionStore}) so a retention confirmed under
   * one principal never leaks into the next one's session, in place of
   * either an unbounded page-global lifetime or a per-workflow expiry long
   * enough to cover every legitimate case.
   */
  clearAll(): void
}

const EMPTY_SLOT: RetainedDeleteSlot = { identified: null, unidentified: null }

export function createPendingDeleteRetentionStore(): PendingDeleteRetentionStore {
  const confirmedDeletes = new Map<string, Map<string, RetainedDeleteSlot>>()

  return {
    settleBatch(candidates) {
      for (const candidate of candidates) {
        let deletes = confirmedDeletes.get(candidate.workflowId)
        if (!deletes) {
          deletes = new Map()
          confirmedDeletes.set(candidate.workflowId, deletes)
        }
        deletes.set(
          candidate.nodeId,
          insertRetainedDelete(
            deletes.get(candidate.nodeId) ?? EMPTY_SLOT,
            candidate.reason,
            candidate.identity
          )
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
    },
    clearAll() {
      confirmedDeletes.clear()
    }
  }
}

/**
 * The production owner: shared across every `useAgentCrdtFollower` call so
 * retention survives a follower being disposed and a new one mounted for the
 * same workflow (panel remount, product-gate toggle). It is not scoped to a
 * principal or workspace by construction - `AgentPanelRoot.vue` is what
 * spans every follower this ADR requires it to outlive, and it is also the
 * seam that knows when the signed-in identity or active workspace changes,
 * so it calls {@link PendingDeleteRetentionStore.clearAll} there rather than
 * this module guessing at a scope key of its own. Tests inject their own
 * instance via {@link createPendingDeleteRetentionStore} so state never
 * leaks between cases.
 */
export const sharedPendingDeleteRetentionStore: PendingDeleteRetentionStore =
  createPendingDeleteRetentionStore()
