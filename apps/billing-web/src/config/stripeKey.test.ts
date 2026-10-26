import { watch } from 'vue'

const h = vi.hoisted(() => ({
  resolveStripePublishableKey: vi.fn<() => Promise<string | undefined>>(),
  buildTimeKey: 'pk_build_time' as string | undefined
}))

vi.mock(import('@comfyorg/account-core/firebase'), () => ({
  resolveStripePublishableKey: h.resolveStripePublishableKey
}))

vi.mock(import('@/config/env'), () => ({
  CLOUD_BASE_URL: 'https://testcloud.comfy.org',
  get STRIPE_PUBLISHABLE_KEY() {
    return h.buildTimeKey
  }
}))

beforeEach(() => {
  h.buildTimeKey = 'pk_build_time'
})

async function freshStripeKey() {
  vi.resetModules()
  return import('@/config/stripeKey')
}

describe('billingWebStripeKey', () => {
  it('answers with the build-time fallback before the fetch settles', async () => {
    h.resolveStripePublishableKey.mockReturnValue(new Promise(() => undefined))
    const { billingWebStripeKey } = await freshStripeKey()

    expect(billingWebStripeKey()).toBe('pk_build_time')
  })

  it('adopts the server key once account-core resolves one', async () => {
    h.resolveStripePublishableKey.mockResolvedValue('pk_server')
    const { billingWebStripeKey } = await freshStripeKey()

    billingWebStripeKey()
    await vi.waitFor(() => expect(billingWebStripeKey()).toBe('pk_server'))
  })

  it('keeps the build-time fallback when the server has no key configured', async () => {
    h.resolveStripePublishableKey.mockResolvedValue(undefined)
    const { billingWebStripeKey } = await freshStripeKey()

    billingWebStripeKey()
    await h.resolveStripePublishableKey.mock.results[0]?.value

    expect(billingWebStripeKey()).toBe('pk_build_time')
  })

  it('stays undefined when neither the build-time fallback nor the server ever provides a key', async () => {
    h.buildTimeKey = undefined
    h.resolveStripePublishableKey.mockResolvedValue(undefined)
    const { billingWebStripeKey } = await freshStripeKey()

    billingWebStripeKey()
    await h.resolveStripePublishableKey.mock.results[0]?.value

    expect(billingWebStripeKey()).toBeUndefined()
  })

  it('joins the shared resolution instead of starting a second one', async () => {
    h.resolveStripePublishableKey.mockResolvedValue(undefined)
    const { billingWebStripeKey } = await freshStripeKey()

    billingWebStripeKey()
    billingWebStripeKey()
    billingWebStripeKey()

    expect(h.resolveStripePublishableKey).toHaveBeenCalledOnce()
  })

  it('passes the Cloud origin and timeout account-core needs to dedupe against the identity fetch', async () => {
    h.resolveStripePublishableKey.mockResolvedValue(undefined)
    const { billingWebStripeKey } = await freshStripeKey()

    billingWebStripeKey()

    expect(h.resolveStripePublishableKey).toHaveBeenCalledWith({
      cloudBaseUrl: 'https://testcloud.comfy.org',
      timeoutMs: 4000
    })
  })

  it('retries the fetch on a later read after a settle with no key', async () => {
    h.buildTimeKey = undefined
    h.resolveStripePublishableKey
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('pk_server')
    const { billingWebStripeKey } = await freshStripeKey()

    billingWebStripeKey()
    await h.resolveStripePublishableKey.mock.results[0]?.value
    expect(billingWebStripeKey()).toBeUndefined()

    billingWebStripeKey()
    await vi.waitFor(() => expect(billingWebStripeKey()).toBe('pk_server'))
    expect(h.resolveStripePublishableKey).toHaveBeenCalledTimes(2)
  })
})

describe('awaitBillingWebStripeKey', () => {
  it('resolves immediately with the build-time fallback, without waiting on the fetch', async () => {
    h.resolveStripePublishableKey.mockReturnValue(new Promise(() => undefined))
    const { awaitBillingWebStripeKey } = await freshStripeKey()

    await expect(awaitBillingWebStripeKey()).resolves.toBe('pk_build_time')
  })

  it('waits out the in-flight fetch when there is no fallback yet', async () => {
    h.buildTimeKey = undefined
    let resolveFetch: (key: string | undefined) => void = () => undefined
    h.resolveStripePublishableKey.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )
    const { awaitBillingWebStripeKey } = await freshStripeKey()

    const pending = awaitBillingWebStripeKey()
    resolveFetch('pk_server')

    await expect(pending).resolves.toBe('pk_server')
  })
})

describe('useBillingWebStripeKey', () => {
  it('a reader that captures the ref at setup still observes a server key that arrives afterward', async () => {
    h.resolveStripePublishableKey.mockResolvedValue('pk_server')
    const { useBillingWebStripeKey } = await freshStripeKey()

    // Simulates a component that reads the ref once during setup, the way
    // CheckoutView/ResultView/SubscriptionActions do, then reacts to it.
    const stripeKey = useBillingWebStripeKey()
    const seen: Array<string | undefined> = []
    watch(stripeKey, (value) => seen.push(value), { immediate: true })

    await vi.waitFor(() => expect(stripeKey.value).toBe('pk_server'))

    expect(seen).toEqual(['pk_build_time', 'pk_server'])
  })
})
