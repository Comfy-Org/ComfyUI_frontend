import type {
  BillingDeclineReason,
  BillingOperationState,
  EmbeddedChallenge,
  PendingBillingOperation
} from './operationState.js'

export type PaymentFrictionSignal =
  | { readonly stage: 'challenge_required' }
  | { readonly stage: 'challenge_completed' }
  | {
      readonly stage: 'challenge_failed'
      readonly declineReason?: BillingDeclineReason
    }

/**
 * What one transition of a pending operation put in the customer's way: a
 * challenge first required under a client secret, this tab's verdict on it,
 * or a retryable decline with a reason the operation did not hold before.
 * The first decline the server reports for a challenge this tab already saw
 * fail is the same failure, so it is not reported twice.
 */
export function paymentFrictionBetween(
  before: BillingOperationState | undefined,
  after: BillingOperationState
): readonly PaymentFrictionSignal[] {
  if (after.phase !== 'pending') return []
  const earlier = before?.phase === 'pending' ? before : undefined
  return [
    ...challengeSignals(earlier?.challenge, after.challenge),
    ...declineSignals(earlier, after)
  ]
}

function challengeSignals(
  before: EmbeddedChallenge | undefined,
  after: EmbeddedChallenge | undefined
): readonly PaymentFrictionSignal[] {
  if (after === undefined) return []
  if (after.clientSecret !== before?.clientSecret) {
    return after.status === 'required' ? [{ stage: 'challenge_required' }] : []
  }
  if (after.status === before.status) return []
  if (after.status === 'completed') return [{ stage: 'challenge_completed' }]
  if (after.status === 'failed') return [{ stage: 'challenge_failed' }]
  return []
}

function declineSignals(
  before: PendingBillingOperation | undefined,
  after: PendingBillingOperation
): readonly PaymentFrictionSignal[] {
  const reason = after.declineReason
  if (reason === undefined || reason === before?.declineReason) return []
  const echoesFailedChallenge =
    after.presentation === 'embedded' &&
    after.challenge?.status === 'failed' &&
    before?.declineReason === undefined
  return echoesFailedChallenge
    ? []
    : [{ stage: 'challenge_failed', declineReason: reason }]
}
