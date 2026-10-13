import type { WorkflowTurnContext } from '../composables/agent/useAgentSession'

interface TurnContextInput {
  id: string | undefined
  tabPath: string
  isTemporary: boolean
  /** Whether the send named an origin tab (as opposed to a detached turn). */
  hasOrigin: boolean
}

/**
 * An unresolved saved tab is marked `unresolved` so the send refuses it:
 * tab-only, the agent would mint a second workflow for a tab that already has
 * one; without a tab, the turn would land on the thread's previous workflow.
 */
export function turnContextFor({
  id,
  tabPath,
  isTemporary,
  hasOrigin
}: TurnContextInput): WorkflowTurnContext {
  if (id !== undefined) return { id, tabPath }
  if (!isTemporary && hasOrigin) return { tabPath, unresolved: true }
  return { tabPath }
}
