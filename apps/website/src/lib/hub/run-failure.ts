import type { RunFailure, RunGate } from '../../config/workshop-run'
import type { Locale } from '../../i18n/translations'
import type { HubKey } from '../../i18n/hub'
import { tHub } from '../../i18n/hub'

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

/**
 * The ways out with something to press. Signing in is a link rather than a
 * button and nothing at all is a real answer, so neither is one of these.
 */
export type RunWayOut = 'resume' | 'retry' | 'credits' | 'personal'

// The four the model half words around a model rather than a workflow are said
// again in the Hub's own copy; the rest is the same sentence either way.
const SAYING: Record<WorkflowFailure, HubKey> = {
  validation: 'workshop.v2.run.rejected',
  upload: 'workshop.error.upload',
  network: 'workshop.error.network',
  client: 'workshop.error.client',
  concurrency: 'workshop.error.concurrency',
  rateLimit: 'workshop.error.rateLimit',
  policy: 'workshop.v2.run.blocked',
  noCredits: 'workshop.error.noCredits',
  unavailable: 'workshop.v2.run.unavailable',
  timeout: 'workshop.error.timeout',
  provider: 'workshop.v2.run.failed',
  signedOut: 'workshop.v2.run.expired'
}

/**
 * What a refusal says, in one place, because the panel shows it and also reads
 * it out to anyone not looking at the panel. Two copies would drift.
 */
export function refusalSaying(
  reason: WorkflowFailure,
  locale: Locale,
  said: { message?: string; memberWorkspace?: string } = {}
): string {
  if (said.message) return said.message
  if (reason === 'noCredits' && said.memberWorkspace !== undefined)
    return tHub('workshop.error.memberNoCredits', locale).replace(
      '{workspace}',
      () => said.memberWorkspace ?? ''
    )
  return tHub(SAYING[reason], locale)
}
