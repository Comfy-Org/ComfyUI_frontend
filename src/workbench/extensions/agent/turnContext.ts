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
 * A resolved tab names its workflow. An unresolved one is sent tab-only, which
 * lets the agent mint a workflow for it and lets the tab adopt that workflow on
 * the ack — EXCEPT for a saved tab: every backend serves the saved-workflow
 * index (GET /workflows), so an unresolved saved tab most likely means that
 * list has not loaded, and a tab-only context would let the agent mint a
 * second workflow for a tab that already has one.
 */
export function turnContextFor({
  id,
  tabPath,
  isTemporary,
  hasOrigin
}: TurnContextInput): WorkflowTurnContext | undefined {
  if (id !== undefined) return { id, tabPath }
  if (!isTemporary && hasOrigin) return undefined
  return { tabPath }
}
