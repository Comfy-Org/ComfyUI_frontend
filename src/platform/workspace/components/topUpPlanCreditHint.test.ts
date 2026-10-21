import { describe, expect, it } from 'vitest'

import { topUpPlanCreditHint } from '@/platform/workspace/components/topUpPlanCreditHint'

describe('topUpPlanCreditHint', () => {
  it.for([
    {
      isCloudBuild: true,
      subscriptionStatus: null,
      hint: 'subscribe'
    },
    {
      isCloudBuild: true,
      subscriptionStatus: 'ended',
      hint: 'resubscribe'
    },
    {
      isCloudBuild: true,
      subscriptionStatus: 'active',
      hint: null
    },
    {
      isCloudBuild: true,
      subscriptionStatus: 'canceled',
      hint: null
    },
    {
      isCloudBuild: false,
      subscriptionStatus: null,
      hint: null
    },
    {
      isCloudBuild: false,
      subscriptionStatus: 'ended',
      hint: null
    }
  ] as const)(
    'is $hint when cloud is $isCloudBuild and status is $subscriptionStatus',
    ({ isCloudBuild, subscriptionStatus, hint }) => {
      expect(
        topUpPlanCreditHint({ isCloud: isCloudBuild, subscriptionStatus })
      ).toBe(hint)
    }
  )
})
