/**
 * Draft reconciliation (prototype — ADR-0004 / ADR-0005 / ADR-0011).
 *
 * Pure decision logic for an incoming `draft_patch`, given the version the tab
 * currently holds. This is the load-bearing correctness piece: it decides
 * whether a full-document replace applies cleanly, must surface the merge
 * dialog, is a stale/duplicate to ignore, or reveals a gap that needs an
 * authoritative refetch.
 *
 * `version` is a monotonic watermark: a patch is adopted only when it advances
 * past what the tab already holds, so a dropped / duplicated / out-of-order
 * Redis Pub/Sub `draft_patch` (the transport is at-most-once, BE-1886) can never
 * regress local state.
 */
import type { DraftPatchEvent } from './agentProtocol'

export type ReconcileResult =
  /** Patch is based on the tab's current version — apply and adopt `version`. */
  | { kind: 'apply'; version: number }
  /** A concurrent user edit advanced the tab — surface the merge dialog. */
  | { kind: 'conflict' }
  /** Patch is superseded by what the tab already has — ignore (idempotency). */
  | { kind: 'stale' }
  /** The agent advanced past the tab — patches were missed; refetch snapshot. */
  | { kind: 'gap' }

/** User's choice in the merge dialog (ADR-0005). */
export type ConflictResolution = 'accept-agent' | 'keep-mine' | 'new-tab'

export function reconcileDraftPatch(
  patch: DraftPatchEvent,
  currentVersion: number
): ReconcileResult {
  if (patch.version <= currentVersion) return { kind: 'stale' }
  if (patch.baseVersion === currentVersion) {
    return { kind: 'apply', version: patch.version }
  }
  if (patch.baseVersion > currentVersion) return { kind: 'gap' }
  return { kind: 'conflict' }
}
