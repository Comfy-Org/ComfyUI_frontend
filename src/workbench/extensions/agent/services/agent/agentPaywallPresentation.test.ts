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

  // One cloud table for the member capability dimension, so a regression here
  // names the member policy only.
  it.for([
    {
      name: 'keeps a member without billing permissions actionless',
      canTopUp: false,
      expected: { kind: 'member' }
    },
    {
      name: 'respects a member top-up capability',
      canTopUp: true,
      expected: { kind: 'subscribed', showUpgrade: false }
    }
  ])('$name', ({ canTopUp, expected }) => {
    expect(
      resolveAgentPaywallPresentation({
        distribution: 'cloud',
        role: 'member',
        tier: 'TEAM',
        canTopUp,
        canSubscribeSelfServe: false
      })
    ).toEqual(expected)
  })

  // The local override is its own policy: it short-circuits before role and
  // capability are read, so it must not be asserted through a member case.
  it('overrides every cloud policy on the local distribution', () => {
    expect(
      resolveAgentPaywallPresentation({
        distribution: 'local',
        role: 'owner',
        tier: null,
        canTopUp: true,
        canSubscribeSelfServe: false
      })
    ).toEqual({ kind: 'local' })
    expect(
      resolveAgentPaywallPresentation({
        distribution: 'local',
        role: 'member',
        tier: 'TEAM',
        canTopUp: true,
        canSubscribeSelfServe: false
      })
    ).toEqual({ kind: 'local' })
  })
})
