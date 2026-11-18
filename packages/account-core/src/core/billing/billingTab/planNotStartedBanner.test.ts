import { describe, expect, it } from 'vitest'

import { planNotStartedBannerFor } from './planNotStartedBanner'

const recovery = {
  billing_op_id: 'op-signup',
  reason: 'payment_required'
} as const

describe('planNotStartedBannerFor', () => {
  it.for([
    {
      case: 'the served plan and its hosted payment page',
      planTier: 'CREATOR',
      paymentPage: 'hostedPage'
    },
    {
      case: 'no plan while the operation has not served one',
      planTier: null,
      paymentPage: 'unknown'
    },
    {
      case: 'an operation that serves no hosted payment page',
      planTier: 'CREATOR',
      paymentPage: 'noHostedPage'
    }
  ] as const)('carries $case', ({ planTier, paymentPage }) => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery,
        planTier,
        paymentPage
      })
    ).toEqual({ planTier, paymentPage })
  })

  it('shows nothing when no recovery is served', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery: null,
        planTier: 'CREATOR',
        paymentPage: 'hostedPage'
      })
    ).toBeNull()
  })

  it('shows nothing on local ComfyUI', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: false,
        recovery,
        planTier: 'CREATOR',
        paymentPage: 'hostedPage'
      })
    ).toBeNull()
  })
})
