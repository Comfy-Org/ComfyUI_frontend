import type { Op } from '@comfyorg/comfy-multi-player'

import { reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'

import { recordDevEvent } from './devPanelLog'

/**
 * Which caller invoked {@link OpSender.abortIfUnbound}, carried through to
 * this report's context/tags so a refused resubscribe (PM-1320's
 * `doc_unsubscribe`-then-`undeliverable` shape) is distinguishable from a
 * tab-switch retarget, instead of both collapsing into the bare `'unbound'`
 * code.
 */
export type UnboundAbortReason = 'subscribe_refused' | 'retarget'

type LostEditKind =
  | 'undeliverable'
  | 'unconfirmed'
  | 'unacknowledged'
  | 'mint_divergence'
  | 'host_rejected'

export function reportLostEdit(
  kind: LostEditKind,
  ops: readonly (Pick<Op, 'op'> & Partial<Pick<Op, 'op_id'>>)[],
  cause: {
    code: string
    errorType?: string
    workflowId?: string
    graphId?: string
    nodeId?: string | number
    classType?: string
    widget?: string
    message?: string
    failedIndex?: number
    /**
     * Which caller drove the `'unbound'` code (refused resubscribe vs.
     * tab-switch retarget). Undefined for every other code, and for the
     * transmit-time/admission-time `'unbound'` races that have no
     * identifiable caller to attribute.
     */
    reason?: UnboundAbortReason
  },
  { shouldReport = true }: { shouldReport?: boolean } = {}
): void {
  const { errorType = `failure_syncing_agent_edit_${kind}`, ...detail } = cause
  const context = {
    ...detail,
    workflowId: cause.workflowId,
    opId: ops[0]?.op_id,
    opIds: ops.map((op) => op.op_id),
    operations: ops.map((op) => op.op)
  }
  if (shouldReport)
    reportError(new Error(errorType), {
      surface: 'agent',
      errorType,
      fingerprint: [errorType],
      level: kind === 'host_rejected' ? 'warning' : 'error',
      tags: {
        tab: api.clientId,
        outcome: kind,
        code: cause.code,
        ...(cause.reason ? { reason: cause.reason } : {})
      },
      context
    })
  if (kind === 'mint_divergence' || kind === 'host_rejected') {
    recordDevEvent(kind, context, { level: 'warn' })
  } else {
    recordDevEvent('human_ops_settled', { state: kind, ops })
  }
}
