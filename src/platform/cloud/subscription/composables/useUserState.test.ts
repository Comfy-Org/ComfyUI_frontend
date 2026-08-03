import { describe, expect, it } from 'vitest'

import { deriveUserState } from './useUserState'

describe('deriveUserState', () => {
  it('is Local off Cloud regardless of subscription state', () => {
    expect(
      deriveUserState({
        isCloud: false,
        isActiveSubscription: true,
        tier: 'PRO'
      })
    ).toEqual({ kind: 'Local' })
  })

  it('is CloudUnsubscribed on Cloud with no active subscription', () => {
    expect(
      deriveUserState({
        isCloud: true,
        isActiveSubscription: false,
        tier: null
      })
    ).toEqual({ kind: 'CloudUnsubscribed' })
  })

  it.for<[Parameters<typeof deriveUserState>[0]['tier'], string]>([
    ['FREE', 'CloudFree'],
    ['STANDARD', 'CloudStandard'],
    ['CREATOR', 'CloudCreator'],
    ['PRO', 'CloudPro'],
    ['FOUNDERS_EDITION', 'CloudFounders']
  ])('maps active Cloud subscription tier %s to %s', ([tier, kind]) => {
    expect(
      deriveUserState({ isCloud: true, isActiveSubscription: true, tier })
    ).toEqual({ kind })
  })

  it('treats an active Cloud subscription with no resolved tier yet as CloudFree', () => {
    expect(
      deriveUserState({ isCloud: true, isActiveSubscription: true, tier: null })
    ).toEqual({ kind: 'CloudFree' })
  })
})
