import type { SubscriptionState } from '@comfyorg/ingest-types'

import type { SubscriptionDialogOptions } from '@/platform/billing/composables/types'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'

/** Subscribe to Run paywall options; flags locked credits for a funded account with no plan. */
export function subscribeToRunDialogOptions(facts: {
  subscriptionState: SubscriptionState | null
  hasFunds: boolean | undefined
}): SubscriptionDialogOptions {
  const creditsLocked = pendingServerFact(
    'BE-24447',
    facts.hasFunds === true &&
      (facts.subscriptionState === 'never_subscribed' ||
        facts.subscriptionState === 'ended')
  )
  return {
    reason: 'subscribe_to_run',
    ...(creditsLocked && { creditsLocked: true })
  }
}
