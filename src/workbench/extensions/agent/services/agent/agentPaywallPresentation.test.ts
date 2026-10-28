import { describe, expect, it } from 'vitest'

import {
  resolveAgentPaywallPresentation,
  toAgentPaywallCta,
  toAgentPaywallReason
} from './agentPaywallPresentation'

describe('resolveAgentPaywallPresentation', () => {
  it('offers local top-up without cloud capabilities or a workspace role', () => {
    expect(
      resolveAgentPaywallPresentation({
        isCloud: false,
        role: undefined,
        tier: null,
        canTopUp: false,
        canSubscribeSelfServe: false,
        hasResolvedCapabilities: false
      })
    ).toEqual({ kind: 'local' })
  })
})

describe('toAgentPaywallReason', () => {
  it.for([
    {
      presentation: { kind: 'subscribed', showUpgrade: true },
      expected: 'no_funds'
    },
    {
      presentation: { kind: 'subscribed', showUpgrade: false },
      expected: 'no_funds'
    },
    { presentation: { kind: 'local' }, expected: 'no_funds' },
    {
      presentation: { kind: 'subscriptionRequired' },
      expected: 'subscription_inactive'
    },
    { presentation: { kind: 'member' }, expected: 'member_cannot_pay' },
    { presentation: { kind: 'salesManaged' }, expected: 'sales_managed' },
    { presentation: { kind: 'unavailable' }, expected: 'unknown' }
  ] as const)(
    'reports $expected for $presentation.kind',
    ({ presentation, expected }) => {
      expect(toAgentPaywallReason(presentation)).toBe(expected)
    }
  )
})

describe('toAgentPaywallCta', () => {
  it.for([
    { action: 'addCredits', expected: 'add_credits' },
    { action: 'subscribe', expected: 'subscribe' },
    { action: 'upgrade', expected: 'upgrade' }
  ] as const)('maps $action to $expected', ({ action, expected }) => {
    expect(toAgentPaywallCta(action)).toBe(expected)
  })
})
