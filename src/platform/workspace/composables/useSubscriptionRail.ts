import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingSdkStore } from '@/platform/workspace/billing/sdk/billingSdkStore'
import type { SubscriptionRail } from '@/platform/workspace/billing/sdk/subscriptionOperationView'

/**
 * Which rail cancel, resubscribe and the payment portal run on. Null is the
 * legacy path.
 *
 * Read once at the start of an action and held for the whole of it, for the
 * same reason as `useTopupOperation`: a flag flip mid-flow must not issue on
 * one rail and observe the result on the other.
 */
export function useSubscriptionRail(): SubscriptionRail | null {
  const { flags } = useFeatureFlags()
  return flags.billingSdkSubscriptionRailEnabled ? useBillingSdkStore() : null
}
