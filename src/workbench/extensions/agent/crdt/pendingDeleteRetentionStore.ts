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

/**
 * Both settle reasons bound an unidentified record the same way and release
 * it by the same expiry check, so there is no `reason` field to carry - it
 * would advertise a policy distinction between reasons that does not exist
 * for this slot.
 */
interface RetainedUnidentified {
  expiresAt: number
}

/**
 * A node id names at most one identified fact and one unidentified fact at
 * once: a settle either names a real identity (merging into `identified`,
 * see {@link insertRetainedDelete}) or names none (merging into
 * `unidentified`), and the two never interact. A map entry backed by
 * neither fact is not a real retention, so this union of the three
 * genuinely non-empty shapes - rather than two independently nullable
 * fields - makes the map incapable of ever holding one: nothing yet to
 * retain is the ABSENCE of an entry (see `insertRetainedDelete`'s `null`
 * seed for a node with no prior slot), never a stored empty value.
 */
type RetainedDeleteSlot =
  | { identified: RetainedIdentified; unidentified: null }
  | { identified: null; unidentified: RetainedUnidentified }
  | { identified: RetainedIdentified; unidentified: RetainedUnidentified }

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

function buildUnidentified(): RetainedUnidentified {
  return { expiresAt: Date.now() + PENDING_DELETE_EXPIRY_MS }
}

function strongerUnidentified(
  existing: RetainedUnidentified,
  incoming: RetainedUnidentified
): RetainedUnidentified {
  return incoming.expiresAt >= existing.expiresAt ? incoming : existing
}

/** Pairs a just-settled `unidentified` with whatever `identified` the slot already had, as one of {@link RetainedDeleteSlot}'s two identified-agnostic shapes. */
function withUnidentified(
  identified: RetainedIdentified | null,
  unidentified: RetainedUnidentified
): RetainedDeleteSlot {
  return identified === null
    ? { identified: null, unidentified }
    : { identified, unidentified }
}

/** Pairs a just-settled `identified` with whatever `unidentified` the slot already had, as one of {@link RetainedDeleteSlot}'s two unidentified-agnostic shapes. */
function withIdentified(
  identified: RetainedIdentified,
  unidentified: RetainedUnidentified | null
): RetainedDeleteSlot {
  return unidentified === null
    ? { identified, unidentified: null }
    : { identified, unidentified }
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
  slot: RetainedDeleteSlot | null,
  reason: RetentionReason,
  deletedItemId: string | null
): RetainedDeleteSlot {
  const existingIdentified = slot?.identified ?? null
  const existingUnidentified = slot?.unidentified ?? null

  if (deletedItemId === null) {
    const incoming = buildUnidentified()
    return withUnidentified(
      existingIdentified,
      existingUnidentified === null
        ? incoming
        : strongerUnidentified(existingUnidentified, incoming)
    )
  }
  const incoming = buildIdentified(reason, deletedItemId)
  const identified =
    existingIdentified !== null &&
    existingIdentified.deletedItemId === deletedItemId
      ? strongerIdentified(existingIdentified, incoming)
      : incoming
  return withIdentified(identified, existingUnidentified)
}

/**
 * `identified` is released by either a different real identity now
 * occupying the id, or its own expiry (a permanent `confirmed-applied` has
 * none). Expiry is independent of `authoritative` - a deadline that has
 * passed has passed regardless of whether this read caught up. Supersession
 * is not: a non-authoritative read's identity is not yet trustworthy either,
 * so it must not be allowed to permanently prune a retention that a later,
 * authoritative read might still need - exactly the absence case this same
 * caller already gates in {@link pruneWorkflowDeletes}.
 */
function pruneIdentified(
  identified: RetainedIdentified,
  currentId: string | null,
  now: number,
  authoritative: boolean
): RetainedIdentified | null {
  const expiresAt = identifiedExpiryOf(identified)
  const expired = expiresAt !== null && now >= expiresAt
  // A null current identity is an unreadable read (internal Yjs-shape
  // failure) or no live doc to read from - never proof a different item
  // replaced this one. Only a real, differing identity supersedes, and only
  // when this read is authoritative.
  const superseded =
    authoritative &&
    currentId !== null &&
    currentId !== identified.deletedItemId
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
 * containing the node at all - releases both, and a different real identity
 * now occupying `identified`'s id releases just that fact; both are gated on
 * `authoritative`, passed through to {@link pruneIdentified}. A transient
 * read of a document that has not caught up yet (e.g. a just-reminted,
 * still-empty replacement, or one that transiently exposes a different
 * identity; see ADR CRDT-WRITE-0035) proves nothing, and must not drop a
 * slot a later, authoritative read would still need.
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
        : pruneIdentified(
            slot.identified,
            currentItemId(id),
            now,
            authoritative
          )
    const unidentified = pruneUnidentified(slot.unidentified, now)
    // Checked independently, never by negating the other's condition: each
    // branch below narrows only the field it actually reads, so the written
    // literal for the other field is always the exclusion its own check
    // proved, never a guess `RetainedDeleteSlot` would reject anyway.
    if (identified !== null && unidentified !== null) {
      deletes.set(id, { identified, unidentified })
    } else if (identified !== null) {
      deletes.set(id, { identified, unidentified: null })
    } else if (unidentified !== null) {
      deletes.set(id, { identified: null, unidentified })
    } else {
      deletes.delete(id)
    }
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
  /**
   * Reports the caller's current best-known principal/workspace scope key,
   * or `null` while it has not resolved yet, and clears every retained
   * delete exactly when the key names a real scope that differs from the
   * last real scope this store has seen - never on account of `null`
   * passing through in between. This store, not any one caller, owns that
   * last-seen value, so calling it is idempotent and safe from every
   * mount of every component that resolves the scope, at any point in its
   * own lifecycle (including immediately on mount): a component that
   * mounts to find the scope already resolved to a different principal
   * than this store last saw still clears, even though nothing changed
   * during that component's own lifetime, and a component whose own
   * resolution briefly passes through `null` before landing back on the
   * SAME scope never clears on account of that detour.
   */
  noteResolvedScope(key: string | null): void
}

export function createPendingDeleteRetentionStore(): PendingDeleteRetentionStore {
  const confirmedDeletes = new Map<string, Map<string, RetainedDeleteSlot>>()
  let lastResolvedScope: string | null = null

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
            deletes.get(candidate.nodeId) ?? null,
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
    },
    noteResolvedScope(key) {
      if (key === null) return
      if (lastResolvedScope !== null && key !== lastResolvedScope) {
        this.clearAll()
      }
      lastResolvedScope = key
    }
  }
}

/**
 * The production owner: shared across every `useAgentCrdtFollower` call so
 * retention survives a follower being disposed and a new one mounted for the
 * same workflow (panel remount, product-gate toggle), and across an
 * `AgentPanelRoot` unmount/remount too - it is a page-lifetime singleton,
 * not scoped to any one component's own mount. `AgentPanelRoot.vue` is the
 * seam that knows the signed-in identity and active workspace, so it
 * reports every resolution of that scope through
 * {@link PendingDeleteRetentionStore.noteResolvedScope}; this store is what
 * remembers the last one and decides whether a given report is an actual
 * principal/workspace change, since a component's own watcher comes and
 * goes with its mount and cannot be trusted to have observed the real
 * transition. Tests inject their own instance via
 * {@link createPendingDeleteRetentionStore} so state never leaks between
 * cases.
 */
export const sharedPendingDeleteRetentionStore: PendingDeleteRetentionStore =
  createPendingDeleteRetentionStore()
