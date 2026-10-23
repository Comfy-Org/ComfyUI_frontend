import { describe, expect, it } from 'vitest'

import { topUpPlanCreditLine } from '@/platform/billing/topUpPlanCreditLine'

const cloudReady = {
  isCloud: true,
  isBillingInitialized: true,
  canTopUp: true
}

describe('topUpPlanCreditLine', () => {
  it.for([
    {
      case: 'a Free workspace that never subscribed',
      facts: { subscriptionState: 'never_subscribed' },
      line: 'planRequiredSubscribe'
    },
    {
      case: 'an ended plan',
      facts: { subscriptionState: 'ended' },
      line: 'planRequiredResubscribe'
    },
    {
      case: 'an active plan',
      facts: { subscriptionState: 'active' },
      line: null
    },
    {
      case: 'a plan scheduled to cancel',
      facts: { subscriptionState: 'cancel_scheduled' },
      line: null
    },
    {
      case: 'an unserved subscription_state',
      facts: { subscriptionState: null },
      line: null
    },
    {
      case: 'a server that refuses top-up',
      facts: { subscriptionState: 'never_subscribed', canTopUp: false },
      line: null
    },
    {
      case: 'local or Desktop',
      facts: { subscriptionState: 'ended', isCloud: false },
      line: null
    },
    {
      case: 'billing still loading',
      facts: {
        subscriptionState: 'never_subscribed',
        isBillingInitialized: false
      },
      line: null
    }
  ] as const)('is $line for $case', ({ facts, line }) => {
    expect(topUpPlanCreditLine({ ...cloudReady, ...facts })).toBe(line)
  })
})
