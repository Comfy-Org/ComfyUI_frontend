import { vi } from 'vitest'
import { computed, ref } from 'vue'

import type { BillingContext } from '../types'
import type { useBillingContext as realUseBillingContext } from '../useBillingContext'

function createBillingContextMock(): BillingContext {
  return {
    type: computed(() => 'legacy'),
    isInitialized: ref(false),
    isLoading: ref(false),
    error: ref(null),
    subscription: computed(() => null),
    balance: computed(() => null),
    plans: computed(() => []),
    currentPlanSlug: computed(() => null),
    teamCreditStops: computed(() => null),
    currentTeamCreditStop: computed(() => null),
    maxSeats: computed(() => null),
    occupiedSeats: computed(() => null),
    canAccessSubscriptionFeatures: computed(() => false),
    isFreeTier: computed(() => false),
    billingStatus: computed(() => null),
    subscriptionStatus: computed(() => null),
    tier: computed(() => null),
    renewalDate: computed(() => null),
    isLegacyTeamPlan: computed(() => false),
    isTeamPlan: computed(() => false),
    canRunWorkflows: computed(() => false),
    showsSubscribeToRunPrompt: computed(() => false),
    getMaxSeats: vi.fn(() => 1),
    initialize: vi.fn(async () => {}),
    fetchStatus: vi.fn(async () => {}),
    fetchBalance: vi.fn(async () => {}),
    subscribe: vi.fn(async () => {}),
    previewSubscribe: vi.fn(async () => null),
    manageSubscription: vi.fn(async () => {}),
    cancelSubscription: vi.fn(async () => {}),
    resubscribe: vi.fn(async () => {}),
    topup: vi.fn(async () => {}),
    fetchPlans: vi.fn(async () => {}),
    requireActiveSubscription: vi.fn(async () => {}),
    showSubscriptionDialog: vi.fn(),
    reconcileSubscriptionSuccess: vi.fn(async () => {})
  }
}

export const useBillingContext = vi.fn<typeof realUseBillingContext>(
  createBillingContextMock
)
