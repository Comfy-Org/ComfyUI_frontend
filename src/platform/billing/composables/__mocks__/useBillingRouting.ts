import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useBillingRouting as realUseBillingRouting } from '@/platform/billing/composables/useBillingRouting'

const defaults: ReturnType<typeof realUseBillingRouting> = {
  type: computed(() => 'workspace'),
  shouldUseWorkspaceBilling: computed(() => true),
  shouldUseUnifiedPricing: computed(() => false)
}

const billingRouting = { ...defaults }

export const useBillingRouting = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(billingRouting, defaults)
  })
  return billingRouting
})
