import type { WorkflowTurnContext } from './composables/agent/useAgentSession'

export interface TurnContextInput {
  /** The workflow the tab resolved to, if any. */
  id: string | undefined
  tabPath: string
  isTemporary: boolean
  /** Whether the send named an origin tab (as opposed to a detached turn). */
  hasOrigin: boolean
  /**
   * True when the tab binding is the ONLY way a tab resolves to a workflow —
   * the standalone agent, which has no ingest workflow list. False in the
   * cloud, where a saved tab also resolves by name through that list.
   */
  bindingIsAuthoritative: boolean
}

/**
 * Which workflow a turn is attributed to.
 *
 * A resolved tab names its workflow. An unresolved one is sent tab-only, which
 * lets the agent mint a workflow for it and lets the tab adopt that workflow on
 * the ack — EXCEPT for a saved tab in the cloud: there "unresolved" most likely
 * means the workflow list has not loaded, and a tab-only context would let the
 * agent mint a second workflow for a tab that already has one. Standalone has
 * no list to wait for, so an unbound saved tab is exactly what a temporary one
 * is: a tab the agent has not yet been given a workflow for.
 */
export function turnContextFor({
  id,
  tabPath,
  isTemporary,
  hasOrigin,
  bindingIsAuthoritative
}: TurnContextInput): WorkflowTurnContext | undefined {
  if (id !== undefined) return { id, tabPath }
  if (!isTemporary && hasOrigin && !bindingIsAuthoritative) return undefined
  return { tabPath }
}
