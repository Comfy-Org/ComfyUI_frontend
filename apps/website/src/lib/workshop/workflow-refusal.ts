import type { WorkshopWorkflowError } from '../../config/workshop-workflow-api'
import type { RunFailure } from '../../config/workshop-run'
import type { WorkflowState } from '../../config/workshop-workflow-state'

/**
 * Which refusal the output panel should stand up, where the panel's own words
 * are about the same event as this page's.
 *
 * The two halves of the Hub refuse things in different vocabularies, and a
 * shared word is not a shared meaning: Cloud denying a workspace is not a
 * provider's content policy, and an input upload that never arrived is not a
 * model being down. So a code reaches the panel only where the sentence the
 * panel already has says what actually happened; everywhere else the page's
 * own accurate sentence stays beside the form, and the panel shows nothing
 * rather than either the wrong words or a picture of a run that succeeded.
 */
export function workflowRunFailure(
  error: Pick<WorkshopWorkflowError, 'code'>
): RunFailure | undefined {
  return REFUSALS.get(error.code)
}

// A Map, not an object: a code the page has never met must read as absent, and
// an object would hand back whatever Object.prototype happens to call by that
// name — 'toString' would arrive as a refusal.
const REFUSALS = new Map<string, RunFailure>([
  // The same sentence in both, and the only way out of it — Add credits, or
  // the reader's own workspace — is the panel's to offer.
  ['insufficient_credits', 'noCredits'],
  // The same sentence in both.
  ['rate_limited', 'rateLimit'],
  // Both about a connection that went while a run may be alive and billed.
  ['network', 'network'],
  // A response that arrived and could not be read, which is what this page
  // otherwise reports only as a run it could not check.
  ['response', 'response'],
  // One event, and the panel says more of it: the credits that may have gone
  // without a result, and the request ID to quote.
  ['execution_failed', 'provider']
])

/**
 * Whether the output panel is the one saying this refusal. The page then keeps
 * quiet beside the form rather than handing the reader the same thing twice —
 * and twice in different words wherever the two vocabularies disagree.
 */
export function panelSaysRefusal(state: WorkflowState): boolean {
  return (
    state.phase === 'failed' && workflowRunFailure(state.error) !== undefined
  )
}
