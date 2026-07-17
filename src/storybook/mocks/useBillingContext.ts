import { computed, ref } from 'vue'

import type { BillingContext } from '@/composables/billing/types'

type Subscription = BillingContext['subscription']['value']

/** The billing state a story wants the stub to report. */
export interface BillingContextMockState {
  subscription: Subscription
  isActiveSubscription: boolean
  isTeamPlan: boolean
  billingStatus: BillingContext['billingStatus']['value']
  subscriptionStatus: BillingContext['subscriptionStatus']['value']
  renewalDate: string | null
}

const defaultState: BillingContextMockState = {
  subscription: null,
  isActiveSubscription: false,
  isTeamPlan: false,
  billingStatus: null,
  subscriptionStatus: null,
  renewalDate: null
}

const state = ref<BillingContextMockState>({ ...defaultState })

/** Drives the stub from a story's `beforeEach`. */
export function setBillingContextMock(next: Partial<BillingContextMockState>) {
  state.value = { ...defaultState, ...next }
}

/**
 * Storybook mock for `useBillingContext`.
 *
 * The real facade lazily instantiates the legacy billing adapter, which pulls
 * in Firebase auth (`setPersistence`) and crashes in the Storybook environment
 * (no Firebase). This stub lets billing components — e.g. UnifiedPricingTable,
 * BillingStatusBanner — render without any network or auth. It defaults to the
 * unsubscribed state; call `setBillingContextMock` to drive a specific one.
 *
 * Typed against `BillingContext` so the stub stays in lockstep with the real
 * composable's return shape: drifted or removed keys fail to compile.
 */
export function useBillingContext(): BillingContext {
  return {
    type: computed(() => 'legacy' as const),
    isInitialized: ref(true),
    subscription: computed(() => state.value.subscription),
    balance: computed(() => null),
    plans: computed(() => []),
    currentPlanSlug: computed(() => null),
    teamCreditStops: computed(() => null),
    currentTeamCreditStop: computed(() => null),
    isLoading: ref(false),
    error: ref<string | null>(null),
    isActiveSubscription: computed(() => state.value.isActiveSubscription),
    canRunWorkflows: computed(() => state.value.isActiveSubscription),
    isFreeTier: computed(() => false),
    isLegacyTeamPlan: computed(() => false),
    isTeamPlan: computed(() => state.value.isTeamPlan),
    billingStatus: computed(() => state.value.billingStatus),
    subscriptionStatus: computed(() => state.value.subscriptionStatus),
    tier: computed(() => null),
    renewalDate: computed(() => state.value.renewalDate),
    getMaxSeats: (tierKey: string) => ({ creator: 5, pro: 20 })[tierKey] ?? 1,
    initialize: async () => {},
    fetchStatus: async () => {},
    fetchBalance: async () => {},
    subscribe: async () => {},
    previewSubscribe: async () => null,
    manageSubscription: async () => {},
    cancelSubscription: async () => {},
    resubscribe: async () => {},
    topup: async () => {},
    fetchPlans: async () => {},
    requireActiveSubscription: async () => {},
    showSubscriptionDialog: () => {}
  }
}
