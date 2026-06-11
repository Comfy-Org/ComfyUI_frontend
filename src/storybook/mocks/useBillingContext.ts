import { computed, ref } from 'vue'

/**
 * Storybook mock for `useBillingContext`.
 *
 * The real facade lazily instantiates the legacy billing adapter, which pulls
 * in Firebase auth (`setPersistence`) and crashes in the Storybook environment
 * (no Firebase). This static stub lets presentational billing components — e.g.
 * UnifiedPricingTable — render against their `TIER_PRICING` / DES-197 fallbacks
 * without any network or auth.
 */
export function useBillingContext() {
  return {
    type: computed(() => 'legacy' as const),
    isInitialized: ref(true),
    subscription: computed(() => null),
    balance: computed(() => null),
    plans: computed(() => []),
    currentPlanSlug: computed(() => null),
    isLoading: ref(false),
    error: ref<string | null>(null),
    isActiveSubscription: computed(() => false),
    isFreeTier: computed(() => false),
    billingStatus: computed(() => null),
    subscriptionStatus: computed(() => null),
    tier: computed(() => null),
    renewalDate: computed(() => null),
    getMaxSeats: () => 1,
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
