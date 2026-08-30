/**
 * Op-outcome surfacing (FEB-6 / s1-D): the pure classification behind the
 * composable's error path for host op results and canvas projection failures.
 *
 * A `doc_ops_result` with `ok:false` means "a failure exists", NOT "nothing
 * landed": the host applies the valid prefix, records the failure, and still
 * broadcasts the update (see the docwire batch contract). Surfacing therefore
 * NEVER implies rollback — the applied prefix stays applied; this module only
 * turns the outcome into something visible (status field, metric, console).
 * The pending-op ledger (CRDT-RM-3) consumes this same seam later, with
 * `op_id` as its correlation key.
 */
import type { DocOpsResult } from './docFrameClient'

/** Visible summary of a host-rejected op batch. */
export interface OpNack {
  workflowId: string | null
  /** Host failure code (e.g. `invalid_node_payload`), when provided. */
  code: string | null
  message: string | null
  /** The wire `failed` object (`{op_id, code, message}`), verbatim. */
  failed: unknown
  /** How many ops of the batch the host DID apply (prefix — still applied). */
  applied: number
  /** Duplicate/no-op op ids the host skipped. */
  skipped: number
}

/**
 * Classify a `doc_ops_result` payload. Returns the nack summary when the host
 * rejected part of the batch (`ok:false`), `null` for a clean result or a
 * malformed payload (the frame parser already dropped truly unreadable
 * frames, so a non-object here is a programming error upstream, not a nack).
 */
export function classifyOpsResult(detail: unknown): OpNack | null {
  if (typeof detail !== 'object' || detail === null) return null
  const d = detail as Partial<DocOpsResult>
  if (d.ok !== false) return null
  return {
    workflowId: typeof d.workflowId === 'string' ? d.workflowId : null,
    code: typeof d.code === 'string' ? d.code : null,
    message: typeof d.message === 'string' ? d.message : null,
    failed: d.failed ?? null,
    applied: Array.isArray(d.applied) ? d.applied.length : 0,
    skipped: Array.isArray(d.skipped) ? d.skipped.length : 0
  }
}

/** Visible summary of a projection (doc → canvas) failure. */
export interface ProjectionFailure {
  message: string
}

/**
 * Run a projection, converting a throw into a reported failure instead of an
 * unhandled listener error (which the EventTarget dispatch path swallows from
 * every caller's perspective — the exact FEB-6 silence). Returns the
 * projection's mutation count, or 0 on failure.
 *
 * Recovery is deliberately NOT attempted here: the projector advances its
 * snapshot before applying, so a retry would double-apply the batch's
 * successful prefix. A failed projection means the canvas may lag the doc
 * until the next update or resubscribe re-materializes it; making that
 * visible is this seam's whole job (observability floor for CRDT-RM-3/RM-6).
 */
export function runProjection(
  project: () => number,
  report: (failure: ProjectionFailure, error: unknown) => void
): number {
  try {
    return project()
  } catch (error) {
    report(
      { message: error instanceof Error ? error.message : String(error) },
      error
    )
    return 0
  }
}
