import { watch } from 'vue'

import type { AgentRunModeValue } from '@/workbench/extensions/agent/schemas/agentApiSchema'

interface AutoModeRunApprovalsOptions {
  mode: () => AgentRunModeValue
  onUserSaved: (listener: (saved: { mode: AgentRunModeValue }) => void) => void
  pendingRunApprovalAskIds: () => readonly string[]
  approve: (askId: string) => void
}

/**
 * Answers run-approval cards with "run" once the user saves plain Auto in
 * this session, until the effective mode leaves Auto. Each ask is answered at
 * most once.
 */
export function useAutoModeRunApprovals({
  mode,
  onUserSaved,
  pendingRunApprovalAskIds,
  approve
}: AutoModeRunApprovalsOptions): void {
  let armed = false
  const attempted = new Set<string>()

  function approvePending(): void {
    if (!armed || mode() !== 'auto') return
    for (const askId of pendingRunApprovalAskIds()) {
      if (attempted.has(askId)) continue
      attempted.add(askId)
      approve(askId)
    }
  }

  onUserSaved((saved) => {
    armed = saved.mode === 'auto'
    approvePending()
  })
  watch(mode, (next) => {
    if (next !== 'auto') armed = false
  })
  watch(pendingRunApprovalAskIds, approvePending)
}
