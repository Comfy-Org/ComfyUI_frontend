import type { CloudFeatures } from '@comfyorg/account-core/firebaseConfigSource'

const h = vi.hoisted(() => ({
  resolveBillingWebFeatures: vi.fn<() => Promise<CloudFeatures>>()
}))

vi.mock(import('@/config/cloudFeatures'), () => ({
  resolveBillingWebFeatures: h.resolveBillingWebFeatures
}))

vi.mock(import('@/config/env'), () => ({
  STRIPE_PUBLISHABLE_KEY: 'pk_build_time'
}))

async function freshStripeKey() {
  vi.resetModules()
  return import('@/config/stripeKey')
}

describe('billingWebStripeKey', () => {
  it('answers with the build-time fallback before the fetch settles', async () => {
    h.resolveBillingWebFeatures.mockReturnValue(new Promise(() => undefined))
    const { billingWebStripeKey } = await freshStripeKey()

    expect(billingWebStripeKey()).toBe('pk_build_time')
  })

  it('adopts the server key once the shared fetch resolves one', async () => {
    h.resolveBillingWebFeatures.mockResolvedValue({
      stripePublishableKey: 'pk_server'
    })
    const { billingWebStripeKey } = await freshStripeKey()

    billingWebStripeKey()
    await vi.waitFor(() => expect(billingWebStripeKey()).toBe('pk_server'))
  })

  it('keeps the build-time fallback when the server has no key configured', async () => {
    h.resolveBillingWebFeatures.mockResolvedValue({})
    const { billingWebStripeKey } = await freshStripeKey()

    billingWebStripeKey()
    await h.resolveBillingWebFeatures.mock.results[0]?.value

    expect(billingWebStripeKey()).toBe('pk_build_time')
  })

  it('joins the shared fetch instead of starting a second one', async () => {
    h.resolveBillingWebFeatures.mockResolvedValue({})
    const { billingWebStripeKey } = await freshStripeKey()

    billingWebStripeKey()
    billingWebStripeKey()
    billingWebStripeKey()

    expect(h.resolveBillingWebFeatures).toHaveBeenCalledOnce()
  })
})
