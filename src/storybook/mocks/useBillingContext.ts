import { computed, ref } from 'vue'

import type { BillingContext } from '@/composables/billing/types'

/**
 * Storybook mock for `useBillingContext`.
 *
 * The real facade lazily instantiates the legacy billing adapter, which pulls
 * in Firebase auth (`setPersistence`) and crashes in the Storybook environment
 * (no Firebase). This static stub lets presentational billing components — e.g.
 * UnifiedPricingTable — render against their `TIER_PRICING` / DES-197 fallbacks
 * without any network or auth.
 *
 * Typed against `BillingContext` so the stub stays in lockstep with the real
 * composable's return shape: drifted or removed keys fail to compile.
 */
export function useBillingContext(): BillingContext {
  return {
    type: computed(() => 'legacy' as const),
    isInitialized: ref(true),
    subscription: computed(() => null),
    balance: computed(() => null),
    plans: computed(() => []),
    currentPlanSlug: computed(() => null),
    teamCreditStops: computed(() => null),
    currentTeamCreditStop: computed(() => null),
    isLoading: ref(false),
    error: ref<string | null>(null),
    isActiveSubscription: computed(() => false),
    canRunWorkflows: computed(() => false),
    isFreeTier: computed(() => false),
    isLegacyTeamPlan: computed(() => false),
    billingStatus: computed(() => null),
    subscriptionStatus: computed(() => null),
    tier: computed(() => null),
    renewalDate: computed(() => null),
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
