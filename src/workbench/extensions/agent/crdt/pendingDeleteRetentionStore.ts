/**
 * Owns retained human-delete intent (ADR CRDT-WRITE-0035) at a scope wider
 * than any single follower instance. `useAgentCrdtFollower`'s `productGate`
 * watch and `AgentPanelRoot.vue`'s own mount/unmount both dispose a follower
 * (bridge, client, sender, projection) and can create a brand new one for
 * the same workflow; a map owned by the disposed follower cannot answer that
 * new follower's first reconcile, which is exactly the window an unconfirmed
 * delete could get resurrected in. Callers inject one instance and thread
 * every workflow's ops through it rather than owning the maps directly, so
 * retention survives replacement: production shares one instance across
 * remounts via {@link getSharedPendingDeleteRetentionStore}, while tests
 * construct a fresh one per case via {@link createPendingDeleteRetentionStore}.
 */
import { STALE_AFTER_MS } from './agentCrdtDocLifecycle'
import type { BatchOutcome } from './opSender'

/** Only a `'unknown'`-reason retention expires; see ADR CRDT-WRITE-0035. */
const PENDING_DELETE_EXPIRY_MS = STALE_AFTER_MS

/** Retention policy per reason: see ADR CRDT-WRITE-0035. */
type RetainedDelete =
  | { reason: 'confirmed-applied'; deletedItemId: string | null }
  | { reason: 'unknown'; expiresAt: number; deletedItemId: string | null }

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

/** Every delete_node op in a settled batch that must keep suppressing its node, paired with the `RetainedDelete` record to store for it. */
function retainedDeletesFromBatch(
  outcome: BatchOutcome,
  capturedItemId: (nodeId: string) => string | null
): Array<[nodeId: string, record: RetainedDelete]> {
  const retained: Array<[string, RetainedDelete]> = []
  for (const op of outcome.ops) {
    if (op.op !== 'delete_node') continue
    let reason: RetainedDelete['reason'] | null = null
    if (outcome.state === 'acknowledged') {
      if (outcome.result.applied.includes(op.op_id))
        reason = 'confirmed-applied'
    } else if (
      outcome.state === 'unconfirmed' ||
      outcome.state === 'unacknowledged'
    ) {
      reason = 'unknown'
    }
    if (!reason) continue
    const nodeId = String(op.node_id)
    const deletedItemId = capturedItemId(nodeId)
    retained.push([
      nodeId,
      reason === 'unknown'
        ? {
            reason,
            expiresAt: Date.now() + PENDING_DELETE_EXPIRY_MS,
            deletedItemId
          }
        : { reason, deletedItemId }
    ])
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
   * attributed to the wrong incarnation. Overwrites any earlier, unconsumed
   * capture for the same node id: the most recently issued delete is always
   * the one a later settle should describe.
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
  const pendingCaptures = new Map<string, Map<string, string | null>>()

  const capturesFor = (workflowId: string): Map<string, string | null> => {
    let captures = pendingCaptures.get(workflowId)
    if (!captures) {
      captures = new Map()
      pendingCaptures.set(workflowId, captures)
    }
    return captures
  }
  const consumeCapturedItemId = (
    workflowId: string,
    nodeId: string
  ): string | null => {
    const captures = pendingCaptures.get(workflowId)
    if (!captures?.has(nodeId)) return null
    const captured = captures.get(nodeId) ?? null
    captures.delete(nodeId)
    return captured
  }

  return {
    captureDeleteIntent(workflowId, nodeId, itemId) {
      capturesFor(workflowId).set(nodeId, itemId)
    },
    settleBatch(outcome) {
      if (outcome.workflowId === null) return
      const workflowId = outcome.workflowId
      const retained = retainedDeletesFromBatch(outcome, (nodeId) =>
        consumeCapturedItemId(workflowId, nodeId)
      )
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

let sharedStore: PendingDeleteRetentionStore | undefined

/**
 * The production owner: one instance per page load, shared across every
 * `useAgentCrdtFollower` call so retention survives a follower being
 * disposed and a new one mounted for the same workflow (a docked-panel
 * close/reopen, or the product-gate toggle). Tests inject their own instance
 * via {@link createPendingDeleteRetentionStore} instead, so state never
 * leaks between cases.
 */
export function getSharedPendingDeleteRetentionStore(): PendingDeleteRetentionStore {
  sharedStore ??= createPendingDeleteRetentionStore()
  return sharedStore
}
