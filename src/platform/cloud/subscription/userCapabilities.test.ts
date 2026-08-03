import { describe, expect, it } from 'vitest'

import { canUseCapability, getUserCapabilities } from './userCapabilities'
import type { UserState } from './userState'

describe('getUserCapabilities', () => {
  it.for<[UserState['kind'], ReturnType<typeof getUserCapabilities>]>([
    ['Local', { canTopUpCredits: true, showsSubscribeUpsellUI: false }],
    [
      'CloudUnsubscribed',
      { canTopUpCredits: false, showsSubscribeUpsellUI: true }
    ],
    ['CloudFree', { canTopUpCredits: false, showsSubscribeUpsellUI: true }],
    ['CloudStandard', { canTopUpCredits: true, showsSubscribeUpsellUI: false }],
    ['CloudCreator', { canTopUpCredits: true, showsSubscribeUpsellUI: false }],
    ['CloudPro', { canTopUpCredits: true, showsSubscribeUpsellUI: false }],
    ['CloudFounders', { canTopUpCredits: true, showsSubscribeUpsellUI: false }]
  ])('maps %s to %o', ([kind, expected]) => {
    expect(getUserCapabilities({ kind })).toEqual(expected)
  })
})

describe('canUseCapability', () => {
  it('reads a single capability off the mapping for the given state', () => {
    expect(canUseCapability({ kind: 'CloudPro' }, 'canTopUpCredits')).toBe(true)
    expect(
      canUseCapability({ kind: 'CloudFree' }, 'showsSubscribeUpsellUI')
    ).toBe(true)
    expect(
      canUseCapability({ kind: 'CloudUnsubscribed' }, 'canTopUpCredits')
    ).toBe(false)
  })
})
