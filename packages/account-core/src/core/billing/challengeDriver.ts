/**
 * Drives one embedded challenge through the host's payment-provider port and
 * reports the verdict back to the lifecycle. The provider object stays on the
 * host side: the core sees only `handleNextAction`, so no provider SDK is
 * imported here and a test can hand in a plain function.
 */
import type { BillingOperationLifecycle } from './operationLifecycle.js'

export interface EmbeddedChallengePort {
  /** Stripe's `handleNextAction` shape: resolve the challenge for one client secret. */
  handleNextAction: (clientSecret: string) => Promise<{
    readonly error?: unknown
    readonly paymentIntent?: { readonly status: string }
  }>
}

/**
 * Statuses that mean the resumed challenge left the intent exactly where it
 * started, so the attempt needs a fresh start rather than a poll. A denylist
 * fails toward the server: an unlisted or future status reports optimistically
 * as completed, and the next poll's own `authentication_state` corrects it.
 */
const UNMOVED_INTENT_STATUSES: ReadonlySet<string> = new Set([
  'requires_payment_method',
  'requires_action',
  'canceled'
])

export type EmbeddedChallengeOutcome =
  | 'completed'
  | 'failed'
  /** No required challenge on an embedded, pending operation with that id. */
  | 'not_required'

type ChallengeLifecycle = Pick<
  BillingOperationLifecycle,
  'get' | 'reportChallengeStarted' | 'reportChallengeSettled'
>

export async function driveEmbeddedChallenge(
  lifecycle: ChallengeLifecycle,
  operationId: string,
  port: EmbeddedChallengePort
): Promise<EmbeddedChallengeOutcome> {
  const state = lifecycle.get(operationId)
  if (
    state?.phase !== 'pending' ||
    state.presentation !== 'embedded' ||
    state.challenge?.status !== 'required'
  ) {
    return 'not_required'
  }

  lifecycle.reportChallengeStarted(operationId)
  const outcome = await settle(port, state.challenge.clientSecret)
  lifecycle.reportChallengeSettled(operationId, outcome)
  return outcome
}

async function settle(
  port: EmbeddedChallengePort,
  clientSecret: string
): Promise<'completed' | 'failed'> {
  try {
    const result = await port.handleNextAction(clientSecret)
    if (result.error !== undefined) return 'failed'
    if (
      result.paymentIntent !== undefined &&
      UNMOVED_INTENT_STATUSES.has(result.paymentIntent.status)
    ) {
      return 'failed'
    }
    return 'completed'
  } catch {
    return 'failed'
  }
}
