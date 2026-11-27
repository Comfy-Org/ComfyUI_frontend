const AGENT_COST_NOTICE_DISMISSED_KEY =
  'Comfy.AgentPanel.agentCostNoticeDismissed'

export function agentCostNoticeDismissedKey(
  userId: string | undefined
): string {
  return userId === undefined
    ? AGENT_COST_NOTICE_DISMISSED_KEY
    : `${AGENT_COST_NOTICE_DISMISSED_KEY}.${userId}`
}
