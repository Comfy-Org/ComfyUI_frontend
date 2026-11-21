import { watch } from 'vue'

import type { AgentRunModeValue } from '@/workbench/extensions/agent/schemas/agentApiSchema'

interface AutoModeRunApprovalsOptions {
  onUserSaved: (listener: (saved: { mode: AgentRunModeValue }) => void) => void
  pendingRunApprovalAskIds: () => readonly string[]
  approve: (askId: string) => void
}

/**
 * Answers run-approval cards with "run" once the user saves plain Auto in this
 * session, until they save another mode. Each ask is answered at most once.
 */
export function useAutoModeRunApprovals({
  onUserSaved,
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

  onUserSaved(({ mode }) => {
    armed = mode === 'auto'
    approvePending()
  })
  watch(pendingRunApprovalAskIds, approvePending)
}
