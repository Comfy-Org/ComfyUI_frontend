import type { ComputedRef, Ref } from 'vue'

import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type {
  BillingCycle,
  TierKey
} from '@/platform/cloud/subscription/constants/tierKey'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { SettledSubscribeResponse } from '@/platform/workspace/billing/sdk/subscriptionOperationView'
import type {
  BillingStatus,
  BillingSubscriptionStatus,
  CreateTopupResponse,
  Plan,
  PreviewSubscribeOptions,
  PreviewSubscribeResponse,
  ScheduledPlanChange,
  SubscribeOptions,
  SubscribeResponse,
  SubscriptionDuration,
  SubscriptionTier,
  TeamCreditStops,
  TeamCreditStopSummary
} from '@/platform/workspace/api/workspaceApi'

export type BillingType = 'legacy' | 'workspace'

export type CheckoutTierKey = Exclude<TierKey, 'free' | 'founder'>

export type SubscriptionCheckoutSelection =
  | {
      planMode: 'personal'
      tierKey: CheckoutTierKey
      billingCycle: BillingCycle
    }
  | {
      planMode: 'team'
      stop: TeamPlanSelection
      billingCycle: BillingCycle
      isChange?: boolean
    }

export interface SubscriptionDialogOptions {
  reason?: PaymentIntentSource
  paymentIntentSource?: PaymentIntentSource
  /**
   * Forces the unified pricing dialog to open on a specific plan tab,
   * overriding the workspace-derived default (e.g. an "Upgrade to Team" CTA
   * always lands on the team tab even from a personal workspace).
   */
  planMode?: 'personal' | 'team'
  /** Starts checkout in workspace billing dialogs; legacy billing stays table-only. */
  initialCheckout?: SubscriptionCheckoutSelection
}

// A type alias, not an interface: `showDialog`'s props are index-signature
// typed, and only object literal types get an implicit index signature.
export type TopUpCreditsDialogOptions = {
  isInsufficientCredits?: boolean
  source?: PaymentIntentSource
}

export interface DowngradeToPersonalResult {
  preview: PreviewSubscribeResponse
  response: SettledSubscribeResponse
}

export interface SubscriptionInfo {
  isActive: boolean
  tier: SubscriptionTier | null
  duration: SubscriptionDuration | null
  planSlug: string | null
  scheduledChange: ScheduledPlanChange | null
  /** ISO 8601; format at the display site. */
  renewalDate: string | null
  /** ISO 8601; format at the display site. */
  endDate: string | null
  isCancelled: boolean
  hasFunds: boolean
}

/**
 * Balance amounts from `GET /customers/balance` and `GET /api/billing/balance`.
 * Despite the `Micros` suffixes every field is in CENTS: the backend reports
 * Metronome's USD-cents credit balance verbatim, so format with
 * `formatCreditsFromCents` (credits) or `formatMetronomeCurrency` (dollars)
 * rather than dividing by 1,000,000.
 */
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
    options?: SubscribeOptions
  ) => Promise<SubscribeResponse | void>
  previewSubscribe: (
    planSlug: string,
    options?: PreviewSubscribeOptions
  ) => Promise<PreviewSubscribeResponse | null>
  manageSubscription: () => Promise<void>
  cancelSubscription: () => Promise<void>
  /**
   * Reactivates a cancelled-but-still-active subscription. Legacy has no
   * dedicated endpoint, so the legacy adapter re-runs the checkout flow.
   * The workspace adapter refreshes status and balance internally on success.
   *
   * `source` identifies the click-time UI surface. The workspace adapter
   * ignores it (its resubscribe call is itself terminal); the legacy adapter
   * carries it through to the pending-checkout-recovery terminal event, since
   * that recovery path is shared with plain subscribes and has no other way
   * to attribute a later-confirmed success back to a resubscribe click.
   */
  resubscribe: (options?: {
    source?: 'pricing_dialog' | 'settings_billing_panel'
  }) => Promise<void>
  /**
   * Purchases additional credits. Standardized on **whole-dollar cents**
   * (multiples of 100); the legacy adapter divides by 100 for the
   * dollar-based /customers/credit endpoint.
   * Pass-through by design: the caller owns the completed/pending follow-up
   * (balance refresh or billing-op polling), so this does not refresh.
   */
  topup: (amountCents: number) => Promise<CreateTopupResponse | void>
  fetchPlans: () => Promise<void>
}

export interface BillingState {
  isInitialized: Ref<boolean>
  subscription: ComputedRef<SubscriptionInfo | null>
  balance: ComputedRef<BalanceInfo | null>
  plans: ComputedRef<Plan[]>
  currentPlanSlug: ComputedRef<string | null>
  /** Team per-credit pricing ladder; null for personal/legacy. */
  teamCreditStops: ComputedRef<TeamCreditStops | null>
  /** The team's currently-subscribed credit stop; null for personal/legacy. */
  currentTeamCreditStop: ComputedRef<TeamCreditStopSummary | null>
  /** Effective member limit for the current workspace; zero is unlimited. */
  maxSeats: ComputedRef<number | null>
  /** Seats occupied in the current workspace. */
  occupiedSeats: ComputedRef<number | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  canAccessSubscriptionFeatures: ComputedRef<boolean>
  /** Reflects the active workspace's tier, not the user's personal tier. */
  isFreeTier: ComputedRef<boolean>
  /** Coarse funding state (`billing_status`). */
  billingStatus: ComputedRef<BillingStatus | null>
  /** Subscription lifecycle state. */
  subscriptionStatus: ComputedRef<BillingSubscriptionStatus | null>
  tier: ComputedRef<SubscriptionTier | null>
  renewalDate: ComputedRef<string | null>
}

export interface BillingContext extends BillingState, BillingActions {
  type: ComputedRef<BillingType>
  reconcileSubscriptionSuccess: () => Promise<void>
  /** Reads the checkout rail's status; true once its pending operation is adopted. */
  readCheckoutOperation: () => Promise<boolean>
  /**
   * True when the active team workspace is still on a pre-credit-slider
   * (legacy) per-member tier plan, which keeps the old team pricing table.
   */
  isLegacyTeamPlan: ComputedRef<boolean>
  /**
   * True when the subscription is a team plan of either generation. Unlike
   * `isLegacyTeamPlan` this does not require an active subscription: the spend
   * gate folds billing_status into is_active, so a paused or payment-failed team
   * plan reports is_active=false and must still read as a team plan.
   */
  isTeamPlan: ComputedRef<boolean>
  getMaxSeats: (tierKey: TierKey) => number
  canRunWorkflows: ComputedRef<boolean>
  showsSubscribeToRunPrompt: ComputedRef<boolean>
}
