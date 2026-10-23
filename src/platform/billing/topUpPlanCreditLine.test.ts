import { describe, expect, it } from 'vitest'

import { topUpPlanCreditLine } from '@/platform/billing/topUpPlanCreditLine'

describe('topUpPlanCreditLine', () => {
  it.for([
    {
      unifiedBillingSettingsEnabled: true,
      isCloud: true,
      isBillingInitialized: true,
      subscriptionStatus: null,
      line: 'planRequiredSubscribe'
    },
    {
      unifiedBillingSettingsEnabled: true,
      isCloud: true,
      isBillingInitialized: false,
      subscriptionStatus: null,
      line: null
    },
    {
      unifiedBillingSettingsEnabled: true,
      isCloud: true,
      isBillingInitialized: true,
      subscriptionStatus: 'ended',
      line: 'planRequiredResubscribe'
    },
    {
      unifiedBillingSettingsEnabled: true,
      isCloud: true,
      isBillingInitialized: true,
      subscriptionStatus: 'active',
      line: null
    },
    {
      unifiedBillingSettingsEnabled: false,
      isCloud: true,
      isBillingInitialized: true,
      subscriptionStatus: null,
      line: null
    },
    {
      unifiedBillingSettingsEnabled: true,
      isCloud: false,
      isBillingInitialized: true,
      subscriptionStatus: 'ended',
      line: null
    }
  ] as const)(
    'is $line when the flag is $unifiedBillingSettingsEnabled, cloud is $isCloud, initialized is $isBillingInitialized, and status is $subscriptionStatus',
    ({
      unifiedBillingSettingsEnabled,
      isCloud,
      isBillingInitialized,
      subscriptionStatus,
      line
    }) => {
      expect(
        topUpPlanCreditLine({
          unifiedBillingSettingsEnabled,
          isCloud,
          isBillingInitialized,
          subscriptionStatus
        })
      ).toBe(line)
    }
  )
})
