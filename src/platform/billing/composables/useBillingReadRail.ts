import type {
  BillingEventsReadOptions,
  BillingResult,
  BillingStatusReadOptions,
  CapabilitiesReadOptions,
  CreditsReadOptions
} from '@comfyorg/account-core/billing'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type {
  BillingBalanceResponse,
  BillingCapabilitiesRead,
  BillingEventsResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  SavedPaymentMethod
} from '@comfyorg/billing-core'

/** The reads a rail serves, in the shape the host's billing state holds. */
export interface BillingReadRail {
  readStatus: (
    options?: BillingStatusReadOptions
  ) => Promise<BillingResult<BillingStatusResponse>>
  readBalance: (
    options?: CreditsReadOptions
  ) => Promise<BillingResult<BillingBalanceResponse>>
  readPlans: () => Promise<BillingResult<BillingPlansResponse>>
  readCapabilities: (
    options: CapabilitiesReadOptions
  ) => Promise<BillingResult<BillingCapabilitiesRead>>
  readPaymentMethods: () => Promise<BillingResult<SavedPaymentMethod[]>>
  /** The only read whose request varies per call: it asks for one page. */
  readEvents: (
    options?: BillingEventsReadOptions
  ) => Promise<BillingResult<BillingEventsResponse>>
}

let useBillingSdkStore: () => BillingReadRail

/** Called by `billingSdkStore` when it loads; the readers it imports reach it through here. */
export function provideBillingSdkStore(useStore: () => BillingReadRail): void {
  useBillingSdkStore = useStore
}

/** The rail the billing reads are served on, read once per fetch. Null is the legacy client. */
export function useBillingReadRail(): BillingReadRail | null {
  const { flags } = useFeatureFlags()
  return flags.billingSdkRailEnabled ? useBillingSdkStore() : null
}
