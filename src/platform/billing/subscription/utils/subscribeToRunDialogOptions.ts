import type {
  SubscriptionDialogOptions,
  SubscriptionInfo
} from '@/platform/billing/composables/types'

/**
 * Options for the paywall opened by the client-side run block and the
 * Subscribe to Run button. An inactive account that still holds credits gets
 * the same locked-credits line as a server-refused run, so a top-up without a
 * plan is explained on every path, not only after a 402.
 */
export function subscribeToRunDialogOptions(
  subscription: Pick<SubscriptionInfo, 'hasFunds'> | null | undefined
): SubscriptionDialogOptions {
  return {
    reason: 'subscribe_to_run',
    ...(subscription?.hasFunds === true && { creditsLocked: true })
  }
}
