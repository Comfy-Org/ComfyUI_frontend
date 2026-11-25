import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { usePlanCreditLine } from '@/platform/billing/composables/useTopUpPlanCreditCopy'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

function endedSalesManagedWorkspace() {
  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({
      isInitialized: ref(true),
      subscriptionState: computed(() => 'ended' as const)
    })
  )
  vi.mocked(useBillingCapabilities).mockReturnValue(
    fromPartial({
      canTopUp: computed(() => true),
      planKind: computed(() => receiveServerFact('plan_kind', 'sales_managed'))
    })
  )
}

describe('usePlanCreditLine', () => {
  it.for([
    { billingNewUxEnabled: false, line: 'planRequiredResubscribe' },
    { billingNewUxEnabled: true, line: 'planRequiredContactSales' }
  ] as const)(
    'is $line for an ended sales-managed workspace when billing_new_ux_enabled is $billingNewUxEnabled',
    ({ billingNewUxEnabled, line }) => {
      endedSalesManagedWorkspace()
      vi.mocked(useFeatureFlags().flags).billingNewUxEnabled =
        billingNewUxEnabled

      expect(usePlanCreditLine().value).toBe(line)
    }
  )

  it('follows the flag when it turns on after the line was first read', () => {
    endedSalesManagedWorkspace()
    const line = usePlanCreditLine()
    expect(line.value).toBe('planRequiredResubscribe')

    vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = true

    expect(line.value).toBe('planRequiredContactSales')
  })
})
