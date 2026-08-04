import { describe, expect, it } from 'vitest'

import { getUserCapabilities } from './userCapabilities'
import type { UserState } from './userState'

describe('getUserCapabilities', () => {
  it.for<[UserState['kind'], ReturnType<typeof getUserCapabilities>]>([
    [
      'LocalWithoutActiveSubscription',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    ],
    [
      'LocalTeamWithoutActiveSubscription',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    ],
    [
      'LocalAndUnknown',
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
    ['LocalAndTeam', { canTopUpCredits: true, showsSubscribeUpsellUI: false }],
    [
      'CloudWithoutActiveSubscription',
      { canTopUpCredits: false, showsSubscribeUpsellUI: true }
    ],
    [
      'CloudTeamWithoutActiveSubscription',
      { canTopUpCredits: false, showsSubscribeUpsellUI: false }
    ],
    [
      'CloudAndUnknown',
      { canTopUpCredits: true, showsSubscribeUpsellUI: false }
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
    ],
    ['CloudAndTeam', { canTopUpCredits: true, showsSubscribeUpsellUI: false }]
  ])('maps %s to %o', ([kind, expected]) => {
    expect(getUserCapabilities({ kind })).toEqual(expected)
  })
})
