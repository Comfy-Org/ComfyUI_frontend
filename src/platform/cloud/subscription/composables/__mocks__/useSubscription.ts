import { onTestFinished, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { useSubscription as realUseSubscription } from '../useSubscription'

function reactiveDefaults() {
  return {
    canAccessSubscriptionFeatures: computed(() => true),
    isInitialized: ref(true),
    isCancelled: computed(() => false),
    formattedRenewalDate: computed(() => ''),
    formattedEndDate: computed(() => ''),
    subscriptionTier: computed(() => null),
    isFreeTier: computed(() => false),
    subscriptionDuration: computed(() => null),
    isYearlySubscription: computed(() => false),
    subscriptionTierName: computed(() => ''),
    subscriptionStatus: ref(null)
  }
}

const subscription: ReturnType<typeof realUseSubscription> = {
  ...reactiveDefaults(),
  isSubscriptionEnabled: vi.fn(() => false),
  subscribe: vi.fn(async () => {}),
  subscribeDirect: vi.fn(async () => {}),
  fetchStatus: vi.fn(async () => undefined),
  showSubscriptionDialog: vi.fn(),
  manageSubscription: vi.fn(async () => {}),
  requireActiveSubscription: vi.fn(async () => {}),
  handleViewUsageHistory: vi.fn(),
  handleLearnMore: vi.fn(),
  handleInvoiceHistory: vi.fn(async () => {})
}

export const useSubscription = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(subscription, reactiveDefaults())
  })
  return subscription
})
