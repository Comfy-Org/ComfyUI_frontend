import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useBillingRouting as realUseBillingRouting } from '../useBillingRouting'

const defaults: ReturnType<typeof realUseBillingRouting> = {
  type: computed(() => 'legacy'),
  shouldUseWorkspaceBilling: computed(() => false),
  shouldUseUnifiedPricing: computed(() => false)
}

const billingRouting = { ...defaults }

export const useBillingRouting = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(billingRouting, defaults)
  })
  return billingRouting
})
