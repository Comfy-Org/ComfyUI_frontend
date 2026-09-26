import type { WorkshopWorkflowError } from '../../config/workshop-workflow-api'
import type { RunFailure } from '../../config/workshop-run'

/**
 * Which refusal the output panel should stand up, in the vocabulary the model
 * half's panel already words and offers a way out of.
 *
 * `undefined` where the shared vocabulary has no word for what happened: a
 * session that expired and a form that went out of date are both things the
 * workflow page says in its own words, and standing them up under a sentence
 * about something else would be worse than leaving them where they are.
 */
export function workflowRunFailure(
  error: Pick<WorkshopWorkflowError, 'code'>
): RunFailure | undefined {
  return REFUSALS[error.code]
}

const REFUSALS: Record<string, RunFailure | undefined> = {
  access_denied: 'policy',
  insufficient_credits: 'noCredits',
  rate_limited: 'rateLimit',
  media_unavailable: 'unavailable',
  execution_failed: 'provider',
  delivery_failed: 'network',
  submission_unknown: 'network',
  network: 'network',
  response: 'response',
  persistence: 'client',
  run_not_found: 'client',
  // Said in the page's own words instead. A session that expired and a form
  // gone out of date the panel has no word for at all; what is wrong with an
  // input belongs beside the input, and the panel's own words for a rejection
  // it cannot pin to a field are about a model rather than a workflow.
  not_authenticated: undefined,
  workflow_not_found: undefined,
  definition_changed: undefined,
  definition_incompatible: undefined,
  invalid_request: undefined,
  invalid_input: undefined,
  payload_too_large: undefined,
  unsupported_media_type: undefined
}
