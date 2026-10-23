import { describe, expect, it } from 'vitest'

import { topUpPlanCreditLine } from '@/platform/billing/topUpPlanCreditLine'

describe('topUpPlanCreditLine', () => {
  it.for([
    {
      unifiedBillingSettingsEnabled: true,
      isCloud: true,
      subscriptionStatus: null,
      line: 'planRequiredSubscribe'
    },
    {
      unifiedBillingSettingsEnabled: true,
      isCloud: true,
      subscriptionStatus: 'ended',
      line: 'planRequiredResubscribe'
    },
    {
      unifiedBillingSettingsEnabled: true,
      isCloud: true,
      subscriptionStatus: 'active',
      line: null
    },
    {
      unifiedBillingSettingsEnabled: false,
      isCloud: true,
      subscriptionStatus: null,
      line: null
    },
    {
      unifiedBillingSettingsEnabled: true,
      isCloud: false,
      subscriptionStatus: 'ended',
      line: null
    }
  ] as const)(
    'is $line when the flag is $unifiedBillingSettingsEnabled, cloud is $isCloud, and status is $subscriptionStatus',
    ({ unifiedBillingSettingsEnabled, isCloud, subscriptionStatus, line }) => {
      expect(
        topUpPlanCreditLine({
          unifiedBillingSettingsEnabled,
          isCloud,
          subscriptionStatus
        })
      ).toBe(line)
    }
  )
})
