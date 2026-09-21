import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingSdkStore } from '@/platform/workspace/billing/sdk/billingSdkStore'
import type { SubscriptionRail } from '@/platform/workspace/billing/sdk/subscriptionOperationView'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

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

/**
 * The pending subscription operation as the billing surfaces read it, from
 * whichever rail owns it. The reads are the commands' other half: an operation
 * issued on the SDK rail is driven by the lifecycle, so a surface reading the
 * legacy store describes one nothing is writing.
 */
export function useSubscriptionOperationView() {
  const { flags } = useFeatureFlags()
  const sdkStore = flags.billingSdkSubscriptionRailEnabled
    ? useBillingSdkStore()
    : null
  const operationStore = useBillingOperationStore()

  const isSettingUp = computed(() =>
    sdkStore ? sdkStore.isSettingUp : operationStore.isSettingUp
  )

  const subscriptionActionUrl = computed(
    () =>
      (sdkStore ?? operationStore).subscriptionActionOperation?.actionUrl ??
      null
  )

  return { isSettingUp, subscriptionActionUrl }
}
