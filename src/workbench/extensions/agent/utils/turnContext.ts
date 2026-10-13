import type { WorkflowTurnContext } from '../composables/agent/useAgentSession'

interface TurnContextInput {
  id: string | undefined
  tabPath: string
  isTemporary: boolean
  /** Whether the send named an origin tab (as opposed to a detached turn). */
  hasOrigin: boolean
}

/** Marks an unresolved saved origin tab `unresolved` so the send refuses it. */
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
