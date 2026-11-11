import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useBillingUI as realUseBillingUI } from '@/platform/billing/composables/useBillingUI'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'

function defaults(): ReturnType<typeof realUseBillingUI> {
  return {
    permissions: computed(() => ({
      canManageSubscription: receiveServerFact('can_manage_subscription', true),
      canManageSubscriptionLifecycle: receiveServerFact(
        'can_manage_subscription',
        true
      ),
      canDowngradeToPersonal: false
    })),
    canReactivatePlan: computed(() => true),
    canOpenPricingSurface: computed(() => true),
    workspaceType: computed(() => 'personal'),
    isInPersonalWorkspace: computed(() => true),
    isWorkspaceSubscribed: computed(() => false),
    canAccessSubscriptionFeatures: computed(() => false),
    isSubscriptionCancelled: computed(() => false),
    isTeamPlanCancelled: computed(() => false)
  }
}

const billingUI = defaults()

export const useBillingUI = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(billingUI, defaults())
  })
  return billingUI
})
