import type {
  SubscriptionDialogOptions,
  SubscriptionInfo
} from '@/platform/billing/composables/types'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'

/**
 * Options for the paywall opened by the client-side run block and the
 * Subscribe to Run button. An inactive account that still holds credits gets
 * the same locked-credits line as a server-refused run, so a top-up without a
 * plan is explained on every path, not only after a 402.
 */
export function subscribeToRunDialogOptions(
  subscription:
    | Pick<SubscriptionInfo, 'isActive' | 'hasFunds'>
    | null
    | undefined
): SubscriptionDialogOptions {
  // Interim: billing status does not yet serve `credits_locked`, which the
  // 402 refusal carries (BE-24447).
  const creditsLocked = pendingServerFact(
    'BE-24447',
    subscription?.isActive === false && subscription.hasFunds
  )
  return {
    reason: 'subscribe_to_run',
    ...(creditsLocked && { creditsLocked: true })
  }
}
