import { describe, expect, it } from 'vitest'

import { selectBillingPresentation } from './presentation.js'

describe('selectBillingPresentation', () => {
  it('embeds only on the workspace Stripe rail with a host that can drive a challenge', () => {
    expect(
      selectBillingPresentation({
        embeddedCheckoutAvailable: true,
        billingRail: 'stripe'
      })
    ).toBe('embedded')
    expect(
      selectBillingPresentation({
        embeddedCheckoutAvailable: false,
        billingRail: 'stripe'
      })
    ).toBe('hosted')
    for (const billingRail of [
      'legacy_stripe',
      'metronome',
      undefined
    ] as const) {
      expect(
        selectBillingPresentation({
          embeddedCheckoutAvailable: true,
          billingRail
        })
      ).toBe('hosted')
    }
  })

  it('follows the backend when it answered with a page and no challenge', () => {
    expect(
      selectBillingPresentation({
        embeddedCheckoutAvailable: true,
        billingRail: 'stripe',
        hostedUrl: 'https://billing.example/pay'
      })
    ).toBe('hosted')
    expect(
      selectBillingPresentation({
        embeddedCheckoutAvailable: true,
        billingRail: 'stripe',
        hostedUrl: 'https://billing.example/pay',
        clientSecret: 'pi_secret'
      })
    ).toBe('embedded')
  })
})
