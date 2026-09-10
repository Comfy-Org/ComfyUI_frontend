import { expect, it } from 'vitest'
import { isTestCheckoutUrl } from './stripe.js'

it('TP-6 EC-P-1: accepts only URLs containing a Stripe test checkout session', () => {
  expect(
    isTestCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_abc123')
  ).toBe(true)
  expect(
    isTestCheckoutUrl('https://checkout.stripe.com/c/pay/cs_live_abc123')
  ).toBe(false)
  expect(isTestCheckoutUrl('not a url cs_test_fake')).toBe(false)
})
