import { describe, expect, it } from 'vitest'

import { planNotStartedBannerFor } from './planNotStartedBanner'

const recovery = {
  billing_op_id: 'op-signup',
  reason: 'payment_required'
} as const

describe('planNotStartedBannerFor', () => {
  it('names the served plan of the unfinished first payment', () => {
    expect(
      planNotStartedBannerFor({ isCloud: true, recovery, planTier: 'CREATOR' })
    ).toEqual({ planTier: 'CREATOR' })
  })

  it('names no plan while the operation has not served one', () => {
    expect(
      planNotStartedBannerFor({ isCloud: true, recovery, planTier: null })
    ).toEqual({ planTier: null })
  })

  it('shows nothing when no recovery is served', () => {
    expect(
      planNotStartedBannerFor({
        isCloud: true,
        recovery: null,
        planTier: 'CREATOR'
      })
    ).toBeNull()
  })

  it('shows nothing on local ComfyUI', () => {
    expect(
      planNotStartedBannerFor({ isCloud: false, recovery, planTier: 'CREATOR' })
    ).toBeNull()
  })
})
