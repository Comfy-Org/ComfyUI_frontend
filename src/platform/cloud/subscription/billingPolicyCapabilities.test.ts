import { describe, expect, it } from 'vitest'

import { getBillingPolicyCapabilities } from './billingPolicyCapabilities'
import type { BillingPolicyState } from './billingPolicyState'

describe('getBillingPolicyCapabilities', () => {
  it.for<
    [
      BillingPolicyState['kind'],
      ReturnType<typeof getBillingPolicyCapabilities>
    ]
  >([
    [
      'LocalWithoutActiveSubscription',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    [
      'LocalTeamWithoutActiveSubscription',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    [
      'LocalAndUnknown',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    ['LocalAndFree', { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }],
    [
      'LocalAndStandard',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    [
      'LocalAndCreator',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    ['LocalAndPro', { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }],
    [
      'LocalAndFounders',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    ['LocalAndTeam', { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }],
    [
      'LocalAndUnrecognizedTier',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    [
      'CloudWithoutActiveSubscription',
      { topUpAccess: 'subscription-required', showsSubscribeUpsellUI: true }
    ],
    [
      'CloudTeamWithoutActiveSubscription',
      { topUpAccess: 'subscription-required', showsSubscribeUpsellUI: false }
    ],
    [
      'CloudAndUnknown',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    [
      'CloudAndFree',
      { topUpAccess: 'subscription-required', showsSubscribeUpsellUI: true }
    ],
    [
      'CloudAndStandard',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    [
      'CloudAndCreator',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    ['CloudAndPro', { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }],
    [
      'CloudAndFounders',
      { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    ],
    ['CloudAndTeam', { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }],
    [
      'CloudAndUnrecognizedTier',
      { topUpAccess: 'subscription-required', showsSubscribeUpsellUI: false }
    ]
  ])('maps %s to %o', ([kind, expected]) => {
    expect(getBillingPolicyCapabilities({ kind })).toEqual(expected)
  })

  it('returns usable capabilities for a state that only exists at runtime', () => {
    const capabilities = getBillingPolicyCapabilities({
      kind: 'CloudAndSomethingNewFromTheBackend'
    } as unknown as Parameters<typeof getBillingPolicyCapabilities>[0])

    expect(capabilities).toBeDefined()
    expect(capabilities.topUpAccess).toBe('allowed')
    expect(capabilities.showsSubscribeUpsellUI).toBe(false)
  })
})
