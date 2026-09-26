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
  invalid_request: 'validation',
  invalid_input: 'validation',
  payload_too_large: 'validation',
  unsupported_media_type: 'validation',
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
  // Said in the page's own words instead, because the panel has none for them.
  not_authenticated: undefined,
  workflow_not_found: undefined,
  definition_changed: undefined,
  definition_incompatible: undefined
}
