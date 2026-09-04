import { describe, expect, it } from 'vitest'

import { returnStepFor, stripeCheckoutHref } from './buy-credits'

describe('stripeCheckoutHref', () => {
  it('sends the page as the return address', () => {
    const url = new URL(stripeCheckoutHref('/workshop/models/vidu-q2/', 25))

    expect(url.origin).toBe('https://checkout.stripe.com')
    expect(url.searchParams.get('success_url')).toBe(
      '/workshop/models/vidu-q2/'
    )
    expect(url.searchParams.get('amount')).toBe('25')
  })

  it('refuses a return address that leaves the site', () => {
    const url = new URL(stripeCheckoutHref('//evil.example/steal', 10))

    expect(url.searchParams.get('success_url')).toBeNull()
  })
})

describe('returnStepFor', () => {
  it('settles on the credits when the grant lands', () => {
    expect(returnStepFor('landed')).toBe('landed')
  })

  it('holds on waiting while the webhook is still in flight', () => {
    expect(returnStepFor('settling')).toBe('waiting')
  })

  it('falls through to the receipt when the grant never arrives', () => {
    expect(returnStepFor('unresolved')).toBe('unresolved')
  })
})
