import type { Op } from '@comfyorg/comfy-multi-player'

import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

import { recordDevEvent } from './devPanelLog'

type LostEditKind =
  | 'undeliverable'
  | 'unconfirmed'
  | 'unacknowledged'
  | 'mint_divergence'
  | 'host_rejected'

export function reportLostEdit(
  kind: LostEditKind,
  ops: readonly (Pick<Op, 'op'> & Partial<Pick<Op, 'op_id'>>)[],
  cause: { code: string; errorType?: string; workflowId?: string }
): void {
  const errorType = cause.errorType ?? `failure_syncing_agent_edit_${kind}`
  const context = {
    code: cause.code,
    workflowId: cause.workflowId,
    opId: ops[0]?.op_id,
    opIds: ops.map((op) => op.op_id),
    operations: ops.map((op) => op.op)
  }
  reportError(new Error(errorType), {
    surface: 'agent',
    errorType,
    fingerprint: [errorType],
    tags: { tab: api.clientId, outcome: kind },
    context
  })
  if (kind === 'mint_divergence' || kind === 'host_rejected') {
    recordDevEvent(kind, context, { level: 'warn' })
  } else {
    recordDevEvent('human_ops_settled', { state: kind, ops })
  }
}
