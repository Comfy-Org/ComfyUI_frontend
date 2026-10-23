import { describe, expect, it } from 'vitest'

import { topUpPlanCreditLine } from '@/platform/workspace/topUpPlanCreditLine'

describe('topUpPlanCreditLine', () => {
  it.for([
    {
      isCloud: true,
      isBillingInitialized: true,
      subscriptionStatus: null,
      line: 'planRequiredSubscribe'
    },
    {
      isCloud: true,
      isBillingInitialized: false,
      subscriptionStatus: null,
      line: null
    },
    {
      isCloud: true,
      isBillingInitialized: true,
      subscriptionStatus: 'ended',
      line: 'planRequiredResubscribe'
    },
    {
      isCloud: true,
      isBillingInitialized: true,
      subscriptionStatus: 'active',
      line: null
    },
    {
      isCloud: false,
      isBillingInitialized: true,
      subscriptionStatus: 'ended',
      line: null
    }
  ] as const)(
    'is $line when cloud is $isCloud, initialized is $isBillingInitialized, and status is $subscriptionStatus',
    ({ isCloud, isBillingInitialized, subscriptionStatus, line }) => {
      expect(
        topUpPlanCreditLine({
          isCloud,
          isBillingInitialized,
          subscriptionStatus
        })
      ).toBe(line)
    }
  )
})
