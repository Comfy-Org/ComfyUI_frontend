import type { BillingResult } from '@comfyorg/account-core/billing'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type {
  BillingBalanceResponse,
  BillingStatusResponse
} from '@/platform/workspace/api/workspaceApi'
import { useBillingSdkStore } from '@/platform/workspace/billing/sdk/billingSdkStore'

/** The two reads a rail serves, in the shape the host's billing state holds. */
export interface BillingReadRail {
  readStatus: () => Promise<BillingResult<BillingStatusResponse>>
  readBalance: () => Promise<BillingResult<BillingBalanceResponse>>
}

/**
 * Which rail the billing status and balance are read on. Null is the legacy
 * client. Either write rail turns the reads on: a status the SDK's lifecycle
 * recovers from, or a balance its top-up refreshes, should come from the same
 * readers those commands already refreshed, or the panels read one thing and
 * the rail settled another.
 *
 * Read once per fetch and held for it, like the write rails: a flag flip
 * mid-read must not start on one client and publish through the other.
 */
export function useBillingReadRail(): BillingReadRail | null {
  const { flags } = useFeatureFlags()
  return flags.billingSdkTopupRailEnabled ||
    flags.billingSdkSubscriptionRailEnabled
    ? useBillingSdkStore()
    : null
}
