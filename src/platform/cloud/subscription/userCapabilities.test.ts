import { describe, expect, it } from 'vitest'

import { canUseCapability, getUserCapabilities } from './userCapabilities'
import type { UserState } from './userState'

describe('getUserCapabilities', () => {
  it.for<[UserState['kind'], ReturnType<typeof getUserCapabilities>]>([
    [
      'LocalAndUnsubscribed',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    ],
    ['LocalAndFree', { canTopUpCredits: true, showsSubscribeUpsellUI: false }],
    [
      'LocalAndStandard',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    ],
    [
      'LocalAndCreator',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    ],
    ['LocalAndPro', { canTopUpCredits: true, showsSubscribeUpsellUI: false }],
    [
      'LocalAndFounders',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    ],
    [
      'CloudAndUnsubscribed',
      { canTopUpCredits: false, showsSubscribeUpsellUI: true }
    ],
    ['CloudAndFree', { canTopUpCredits: false, showsSubscribeUpsellUI: true }],
    [
      'CloudAndStandard',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    ],
    [
      'CloudAndCreator',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    ],
    ['CloudAndPro', { canTopUpCredits: true, showsSubscribeUpsellUI: false }],
    [
      'CloudAndFounders',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    ]
  ])('maps %s to %o', ([kind, expected]) => {
    expect(getUserCapabilities({ kind })).toEqual(expected)
  })
})

describe('canUseCapability', () => {
  it('reads a single capability off the mapping for the given state', () => {
    expect(canUseCapability({ kind: 'CloudAndPro' }, 'canTopUpCredits')).toBe(
      true
    )
    expect(
      canUseCapability({ kind: 'CloudAndFree' }, 'showsSubscribeUpsellUI')
    ).toBe(true)
    expect(
      canUseCapability({ kind: 'CloudAndUnsubscribed' }, 'canTopUpCredits')
    ).toBe(false)
  })
})
