import { describe, expect, it } from 'vitest'

import {
  DEFAULT_AGENT_PAYWALL_PRESENTATION,
  isResolvedAgentPaywall,
  resolveAgentPaywallPresentation,
  toAgentPaywallCta,
  toAgentPaywallReason
} from './agentPaywallPresentation'

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

describe('toAgentPaywallReason', () => {
  // Every paywall card originates in a `no_funds` admission refusal, so the
  // presentation contributes the remediation-relevant state on top of that.
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

  // Precedence is the resolver's own branch order rather than a second
  // ordering: a workspace that cannot top up reads as needing a subscription
  // even though its balance is also empty.
  it('prefers subscription_inactive over no_funds when both apply', () => {
    expect(
      toAgentPaywallReason(
        resolveAgentPaywallPresentation({
          distribution: 'cloud',
          role: 'owner',
          tier: null,
          canTopUp: false,
          canSubscribeSelfServe: true
        })
      )
    ).toBe('subscription_inactive')
  })
})

describe('isResolvedAgentPaywall', () => {
  it('treats the pre-bootstrap default as unresolved', () => {
    expect(isResolvedAgentPaywall(DEFAULT_AGENT_PAYWALL_PRESENTATION)).toBe(
      false
    )
  })

  it.for([
    { kind: 'subscribed', showUpgrade: false },
    { kind: 'subscriptionRequired' },
    { kind: 'member' },
    { kind: 'salesManaged' },
    { kind: 'local' }
  ] as const)('treats $kind as a resolved verdict', (presentation) => {
    expect(isResolvedAgentPaywall(presentation)).toBe(true)
  })
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
