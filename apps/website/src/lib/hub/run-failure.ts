import type { RunFailure, RunGate } from '../../config/workshop-run'

/**
 * What stopped a run, in the model half's own words, so that a reader
 * crossing between the two halves is told the same thing under the same name.
 * Only the reasons Cloud's prompt API actually tells apart are here, and a
 * session that expired mid-run is the model half's gate rather than one of
 * its failures. Renaming one of those words there stops this list compiling.
 */
export const WORKFLOW_FAILURES = [
  'validation',
  'upload',
  'network',
  'client',
  'concurrency',
  'rateLimit',
  'policy',
  'noCredits',
  'unavailable',
  'timeout',
  'provider',
  'signedOut'
] as const satisfies readonly (RunFailure | RunGate)[]

export type WorkflowFailure = (typeof WORKFLOW_FAILURES)[number]

// Documented on /api/prompt: a billing gate retrying never clears, whichever
// of the four names it arrives under.
const BILLING = new Set([
  'PAYMENT_REQUIRED',
  'FREE_TIER_UNAVAILABLE',
  'FREE_TIER_EXHAUSTED',
  'PARTNER_NODE_PAYMENT_REQUIRED'
])

/**
 * Which of them Cloud just reported. A 429 is two unrelated things and the
 * body's `error.type` says which, so the type is read rather than the message
 * matched, as the API's own documentation requires.
 */
export function workflowFailure(
  status: number,
  type: string | undefined
): WorkflowFailure {
  if (type && BILLING.has(type)) return 'noCredits'
  if (status === 429)
    return type === 'QUEUE_LIMIT' ? 'concurrency' : 'rateLimit'
  if (status === 401) return 'signedOut'
  if (status === 402) return 'noCredits'
  if (status === 403) return 'policy'
  if (status === 400 || status === 422) return 'validation'
  if (status === 413) return 'client'
  if (status === 503) return 'unavailable'
  return 'provider'
}

/** The one way out worth offering, or none where nothing the reader does helps. */
export type FailureAction = 'retry' | 'credits' | 'personal' | 'signIn' | 'none'

export function failureAction(
  failure: WorkflowFailure,
  member: boolean
): FailureAction {
  if (failure === 'noCredits') return member ? 'personal' : 'credits'
  if (failure === 'signedOut') return 'signIn'
  return ['validation', 'policy', 'client'].includes(failure) ? 'none' : 'retry'
}
