import { describe, expect, it } from 'vitest'

import { planNotStartedBannerFor } from './planNotStartedBanner'

const recovery = {
  billing_op_id: 'op-signup',
  reason: 'payment_required'
} as const
const PAYMENT_PAGE = 'https://invoice.stripe.example/i/signup'

describe('planNotStartedBannerFor', () => {
  it('names the served plan and payment page of the unfinished first payment', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery,
        planTier: 'CREATOR',
        actionUrl: PAYMENT_PAGE
      })
    ).toEqual({ planTier: 'CREATOR', actionUrl: PAYMENT_PAGE })
  })

  it('names no plan while the operation has not served one', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery,
        planTier: null,
        actionUrl: PAYMENT_PAGE
      })
    ).toEqual({ planTier: null, actionUrl: PAYMENT_PAGE })
  })

  it('offers no payment page while the operation serves none', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery,
        planTier: 'CREATOR',
        actionUrl: null
      })
    ).toEqual({ planTier: 'CREATOR', actionUrl: null })
  })

  it('shows nothing when no recovery is served', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery: null,
        planTier: 'CREATOR',
        actionUrl: PAYMENT_PAGE
      })
    ).toBeNull()
  })

  it('shows nothing on local ComfyUI', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: false,
        recovery,
        planTier: 'CREATOR',
        actionUrl: PAYMENT_PAGE
      })
    ).toBeNull()
  })
})
