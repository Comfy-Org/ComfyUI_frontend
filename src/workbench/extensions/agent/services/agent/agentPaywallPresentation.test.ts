import { describe, expect, it } from 'vitest'

import { resolveAgentPaywallPresentation } from './agentPaywallPresentation'

describe('resolveAgentPaywallPresentation', () => {
  it.for([
    {
      name: 'both self-serve actions',
      canTopUp: true,
      canSubscribeSelfServe: true,
      expected: { kind: 'subscribed', showUpgrade: true }
    },
    {
      name: 'top-up only',
      canTopUp: true,
      canSubscribeSelfServe: false,
      expected: { kind: 'subscribed', showUpgrade: false }
    },
    {
      name: 'subscription required',
      canTopUp: false,
      canSubscribeSelfServe: true,
      expected: { kind: 'subscriptionRequired' }
    },
    {
      name: 'sales-managed owner',
      canTopUp: false,
      canSubscribeSelfServe: false,
      expected: { kind: 'salesManaged' }
    }
  ])('maps the ready server pair for $name', (testCase) => {
    expect(
      resolveAgentPaywallPresentation({
        distribution: 'cloud',
        role: 'owner',
        tier: 'STANDARD',
        canTopUp: testCase.canTopUp,
        canSubscribeSelfServe: testCase.canSubscribeSelfServe
      })
    ).toEqual(testCase.expected)
  })

  it.for([
    { tier: 'STANDARD' as const, showUpgrade: true },
    { tier: 'CREATOR' as const, showUpgrade: true },
    { tier: 'PRO' as const, showUpgrade: false },
    { tier: 'FOUNDERS_EDITION' as const, showUpgrade: false },
    { tier: 'TEAM' as const, showUpgrade: false },
    { tier: 'ENTERPRISE' as const, showUpgrade: false },
    { tier: null, showUpgrade: false }
  ])(
    'offers Upgrade plan only from a personal tier with a higher tier ($tier)',
    ({ tier, showUpgrade }) => {
      expect(
        resolveAgentPaywallPresentation({
          distribution: 'cloud',
          role: 'owner',
          tier,
          canTopUp: true,
          canSubscribeSelfServe: true
        })
      ).toEqual({ kind: 'subscribed', showUpgrade })
    }
  )

  it('keeps members without billing permissions actionless', () => {
    expect(
      resolveAgentPaywallPresentation({
        distribution: 'cloud',
        role: 'member',
        tier: 'STANDARD',
        canTopUp: false,
        canSubscribeSelfServe: false
      })
    ).toEqual({ kind: 'member' })
    expect(
      resolveAgentPaywallPresentation({
        distribution: 'local',
        role: 'owner',
        tier: null,
        canTopUp: true,
        canSubscribeSelfServe: false
      })
    ).toEqual({ kind: 'local' })
  })

  it.for([
    {
      distribution: 'cloud' as const,
      expected: { kind: 'subscribed', showUpgrade: false }
    },
    { distribution: 'local' as const, expected: { kind: 'local' } }
  ])(
    'respects a member top-up capability on $distribution',
    ({ distribution, expected }) => {
      expect(
        resolveAgentPaywallPresentation({
          distribution,
          role: 'member',
          tier: 'TEAM',
          canTopUp: true,
          canSubscribeSelfServe: false
        })
      ).toEqual(expected)
    }
  )
})
