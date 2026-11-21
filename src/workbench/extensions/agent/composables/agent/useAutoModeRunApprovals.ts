import { watch } from 'vue'

import type { AgentRunModeValue } from '@/workbench/extensions/agent/schemas/agentApiSchema'

interface AutoModeRunApprovalsOptions {
  /** The SAVED run mode (what the server will enforce on the next turn). */
  mode: () => AgentRunModeValue
  /** Run-approval asks still waiting for an answer, on any live turn. */
  pendingRunApprovalAskIds: () => readonly string[]
  /** Answer one run-approval ask with "run". */
  approve: (askId: string) => void
}

/**
 * PM-2612: the server pins a turn's run mode at launch, so a turn started in
 * Ask keeps parking every `run` on a consent card even after the user switches
 * to Auto. Switching to Auto is the user saying "stop asking", so from that
 * switch on this answers those cards with "run" for them. Each run still goes
 * through the same answered ask the server already checks; nothing about the
 * pinned gate changes.
 *
 * Only a switch made in this session arms it, so a card that is already open
 * when the panel loads in Auto is left for the user. Only plain Auto counts:
 * an ask-pinned turn has no credit cap, so Auto with a credit limit would run
 * past the limit the user picked. Leaving Auto disarms it. Each ask is tried
 * once; a failed answer leaves the card for the user.
 */
export function useAutoModeRunApprovals({
  mode,
  pendingRunApprovalAskIds,
  approve
}: AutoModeRunApprovalsOptions): void {
  let armed = false
  const attempted = new Set<string>()

  function approvePending(): void {
    if (!armed) return
    for (const askId of pendingRunApprovalAskIds()) {
      if (attempted.has(askId)) continue
      attempted.add(askId)
      approve(askId)
    }
  }

  watch(mode, (next) => {
    armed = next === 'auto'
    approvePending()
  })
  watch(pendingRunApprovalAskIds, approvePending)
}
