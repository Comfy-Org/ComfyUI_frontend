import { describe, expect, it } from 'vitest'

import type { RecoveryPaymentPage } from './planNotStartedBanner'
import { planNotStartedBannerFor } from './planNotStartedBanner'

const recovery = {
  billing_op_id: 'op-signup',
  reason: 'payment_required'
} as const

const CHECKOUT_URL =
  'https://billing.comfy.org/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=creator-monthly'

describe('planNotStartedBannerFor', () => {
  it.for<{ case: string; paymentPage: RecoveryPaymentPage }>([
    { case: 'a hosted payment page', paymentPage: { kind: 'hostedPage' } },
    {
      case: 'only a client secret, with its billing-web checkout',
      paymentPage: { kind: 'clientSecretOnly', checkoutUrl: CHECKOUT_URL }
    },
    {
      case: 'no way to pay from a failed read',
      paymentPage: { kind: 'unavailable' }
    }
  ])('carries the served plan and $case', ({ paymentPage }) => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery,
        planTier: 'CREATOR',
        paymentPage
      })
    ).toEqual({ planTier: 'CREATOR', paymentPage })
  })

  it('shows nothing while the operation is loading', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery,
        planTier: null,
        paymentPage: { kind: 'loading' }
      })
    ).toBeNull()
  })

  it('shows nothing when no recovery is served', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery: null,
        planTier: 'CREATOR',
        paymentPage: { kind: 'hostedPage' }
      })
    ).toBeNull()
  })

  it('shows nothing on local ComfyUI', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: false,
        recovery,
        planTier: 'CREATOR',
        paymentPage: { kind: 'hostedPage' }
      })
    ).toBeNull()
  })
})
