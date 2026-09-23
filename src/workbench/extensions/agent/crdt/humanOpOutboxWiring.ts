/**
 * Sender <-> outbox wiring (mutref-3 / M7 s2). Two pure adapters that keep a
 * `HumanOpOutbox` in step with one `OpSender`, and one replay step that hands
 * a workflow's parked ops back to that sender WITHOUT minting them again.
 *
 * Why a separate module: the sender reports outcomes by op identity only
 * (`BatchOutcome.ops`), never by workflow — a `BatchOutcome` addressed to a
 * workflow would leak addressing into every settle-site test. The outbox, by
 * contrast, refuses to rule on a member outside the workflow it was recorded
 * against (FC-5). This module bridges the two by looking the workflow up in
 * the outbox's own record: a minted op id belongs to exactly one entry, and
 * that entry knows its workflow. The follower composable wires these in
 * (m7-s3); nothing here touches the socket, timers, or Vue.
 */
import type { Op } from '@comfyorg/comfy-multi-player'

import type { HumanOpOutbox, SettleSummary } from './humanOpOutbox'
import type { BatchOutcome, OpSender, OpSenderDeps } from './opSender'

export type OutboxSenderHooks = Required<
  Pick<OpSenderDeps, 'onBatchMinted'>
> & {
  /**
   * Apply one terminal outcome to the outbox. Returns null when the batch was
   * never recorded: minted while no doc was bound (it settled `undeliverable`
   * before `onBatchMinted` could fire, and there is no workflow to replay it
   * toward), or already dropped by a lineage break.
   */
  onBatchSettled(outcome: BatchOutcome): SettleSummary | null
}

/** Hooks to spread into `createOpSender`'s deps so every mint and settle lands in the outbox. */
export function outboxSenderHooks(outbox: HumanOpOutbox): OutboxSenderHooks {
  return {
    onBatchMinted(workflowId, ops) {
      outbox.record(workflowId, ops)
    },
    onBatchSettled(outcome) {
      const workflowId = recordedWorkflowOf(outbox, outcome.ops)
      return workflowId === null ? null : outbox.settle(workflowId, outcome)
    }
  }
}

/**
 * Replay one workflow's parked ops through the sender with their original
 * ids: parked -> queued in the outbox, then `readmit` + `flush`. If the
 * sender is not bound to `workflowId` any more it settles the replay
 * `undeliverable` at once, which parks the same entries again through
 * `onBatchSettled` — replay is always safe to attempt. Returns how many ops
 * were handed over.
 */
export function replayParkedOps(
  outbox: HumanOpOutbox,
  sender: Pick<OpSender, 'readmit' | 'flush'>,
  workflowId: string
): number {
  const ops = outbox.requeue(workflowId)
  if (ops.length === 0) return 0
  sender.readmit(workflowId, ops)
  sender.flush()
  return ops.length
}

/**
 * The workflow a batch was recorded against, from the first member the outbox
 * knows. Members of one batch always share a workflow: the sender mints and
 * seals per bound workflow, and `readmit` is per workflow too.
 */
function recordedWorkflowOf(
  outbox: HumanOpOutbox,
  ops: readonly Op[]
): string | null {
  const ids = new Set(ops.map((op) => op.op_id))
  const entry = outbox
    .entries()
    .find((candidate) => ids.has(candidate.op.op_id))
  return entry?.workflowId ?? null
}
