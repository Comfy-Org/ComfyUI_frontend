import type { ComputedRef, Ref } from 'vue'

import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  BillingStatus,
  BillingSubscriptionStatus,
  CreateTopupResponse,
  Plan,
  PreviewSubscribeResponse,
  SubscribeResponse,
  SubscriptionDuration,
  SubscriptionTier
} from '@/platform/workspace/api/workspaceApi'

export type BillingType = 'legacy' | 'workspace'

export interface SubscriptionInfo {
  isActive: boolean
  tier: SubscriptionTier | null
  duration: SubscriptionDuration | null
  planSlug: string | null
  renewalDate: string | null
  endDate: string | null
  isCancelled: boolean
  hasFunds: boolean
}

export interface BalanceInfo {
  amountMicros: number
  currency: string
  effectiveBalanceMicros?: number
  prepaidBalanceMicros?: number
  cloudCreditBalanceMicros?: number
}

export interface BillingActions {
  initialize: () => Promise<void>
  fetchStatus: () => Promise<void>
  fetchBalance: () => Promise<void>
  subscribe: (
    planSlug: string,
    returnUrl?: string,
    cancelUrl?: string
  ) => Promise<SubscribeResponse | void>
  previewSubscribe: (
    planSlug: string
  ) => Promise<PreviewSubscribeResponse | null>
  manageSubscription: () => Promise<void>
  cancelSubscription: () => Promise<void>
  /**
   * Reactivates a cancelled-but-still-active subscription. Legacy has no
   * dedicated endpoint, so the legacy adapter re-runs the checkout flow.
   */
  resubscribe: () => Promise<void>
  /**
   * Purchases additional credits. Standardized on **cents**; the legacy
   * adapter converts to dollars for the /customers/credit endpoint.
   */
  topup: (amountCents: number) => Promise<CreateTopupResponse | void>
  fetchPlans: () => Promise<void>
  /**
   * Ensures billing is initialized and subscription is active.
   * Shows subscription dialog if not subscribed.
   * Use this in extensions/entry points that require active subscription.
   */
  requireActiveSubscription: () => Promise<void>
  /**
   * Shows the subscription dialog.
   */
  showSubscriptionDialog: () => void
}

export interface BillingState {
  isInitialized: Ref<boolean>
  subscription: ComputedRef<SubscriptionInfo | null>
  balance: ComputedRef<BalanceInfo | null>
  plans: ComputedRef<Plan[]>
  currentPlanSlug: ComputedRef<string | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  /**
   * Convenience computed for checking if subscription is active.
   * Equivalent to `subscription.value?.isActive ?? false`
   */
  isActiveSubscription: ComputedRef<boolean>
  /**
   * Whether the current billing context has a FREE tier subscription.
   * Workspace-aware: reflects the active workspace's tier, not the user's personal tier.
   */
  isFreeTier: ComputedRef<boolean>
  /**
   * Coarse billing/funding state (workspace `billing_status`). Drives the
   * orientation banners (B6). Legacy has no equivalent and reports null.
   */
  billingStatus: ComputedRef<BillingStatus | null>
  /**
   * Subscription lifecycle state (`subscription_status`). Legacy synthesizes
   * it from active/cancelled flags.
   */
  subscriptionStatus: ComputedRef<BillingSubscriptionStatus | null>
  /** Convenience accessor for the active subscription tier. */
  tier: ComputedRef<SubscriptionTier | null>
  /** Convenience accessor for the next renewal date (ISO string). */
  renewalDate: ComputedRef<string | null>
}

export interface BillingContext extends BillingState, BillingActions {
  type: ComputedRef<BillingType>
  getMaxSeats: (tierKey: TierKey) => number
}
