import type { WorkflowTurnContext } from './composables/agent/useAgentSession'

export interface TurnContextInput {
  /** The workflow the tab resolved to, if any. */
  id: string | undefined
  tabPath: string
  isTemporary: boolean
  /** Whether the send named an origin tab (as opposed to a detached turn). */
  hasOrigin: boolean
}

/**
 * Which workflow a turn is attributed to.
 *
 * A resolved tab names its workflow. An unresolved temporary tab is sent
 * tab-only, which lets the agent mint a workflow for it and lets the tab adopt
 * that workflow on the ack. An unresolved SAVED tab is different: every backend
 * serves the saved-workflow index (GET /workflows), so it most likely means the
 * list has not loaded, and a tab-only context would let the agent mint a
 * second workflow for a tab that already has one. It keeps its identity and is
 * marked `unresolved`, so the send can refuse it rather than attribute it to
 * the thread's previous workflow.
 */
export function turnContextFor({
  id,
  tabPath,
  isTemporary,
  hasOrigin
}: TurnContextInput): WorkflowTurnContext | undefined {
  if (id !== undefined) return { id, tabPath }
  if (!isTemporary && hasOrigin) return { tabPath, unresolved: true }
  return { tabPath }
}
