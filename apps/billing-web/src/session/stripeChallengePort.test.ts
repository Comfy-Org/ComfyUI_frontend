const h = vi.hoisted(() => ({
  loadStripe: vi.fn()
}))

vi.mock<unknown>(import('@stripe/stripe-js/pure'), () => ({
  loadStripe: h.loadStripe
}))

import { createDeferredStripeChallengePort } from '@/session/stripeChallengePort'

describe('createDeferredStripeChallengePort', () => {
  beforeEach(() => {
    h.loadStripe.mockReset()
  })

  it('reports the challenge unavailable when no key is present at call time', async () => {
    const port = createDeferredStripeChallengePort(() => undefined)

    const result = await port.handleNextAction('secret')

    expect(result).toEqual({ error: 'provider_unavailable' })
    expect(h.loadStripe).not.toHaveBeenCalled()
  })

  it('picks up a key that only becomes available after the port was created', async () => {
    const state: { key: string | undefined } = { key: undefined }
    const handleNextAction = vi.fn(async () => ({
      paymentIntent: { status: 'succeeded' }
    }))
    h.loadStripe.mockResolvedValue({ handleNextAction })
    const port = createDeferredStripeChallengePort(() => state.key)

    // No key yet: the setup-time snapshot this replaces would stay stuck here.
    await expect(port.handleNextAction('secret')).resolves.toEqual({
      error: 'provider_unavailable'
    })

    state.key = 'pk_server'
    const result = await port.handleNextAction('secret')

    expect(result).toEqual({ paymentIntent: { status: 'succeeded' } })
    expect(h.loadStripe).toHaveBeenCalledWith('pk_server')
  })

  it('rebuilds the provider when the server key arrives after a challenge already ran on the fallback key', async () => {
    const fallbackHandleNextAction = vi.fn(async () => ({
      paymentIntent: { status: 'succeeded' }
    }))
    const serverHandleNextAction = vi.fn(async () => ({
      paymentIntent: { status: 'succeeded' }
    }))
    h.loadStripe.mockImplementation((key: string) =>
      Promise.resolve({
        handleNextAction:
          key === 'pk_fallback'
            ? fallbackHandleNextAction
            : serverHandleNextAction
      })
    )
    const state: { key: string } = { key: 'pk_fallback' }
    const port = createDeferredStripeChallengePort(() => state.key)

    await port.handleNextAction('secret')

    state.key = 'pk_server'
    await port.handleNextAction('secret')

    expect(h.loadStripe).toHaveBeenCalledWith('pk_server')
    expect(serverHandleNextAction).toHaveBeenCalledTimes(1)
    expect(fallbackHandleNextAction).toHaveBeenCalledTimes(1)
  })

  it('builds the provider once when the key does not change between challenges', async () => {
    const handleNextAction = vi.fn(async () => ({
      paymentIntent: { status: 'succeeded' }
    }))
    h.loadStripe.mockResolvedValue({ handleNextAction })
    const port = createDeferredStripeChallengePort(() => 'pk_stable')

    await port.handleNextAction('secret')
    await port.handleNextAction('secret')

    expect(h.loadStripe).toHaveBeenCalledTimes(1)
  })

  it('waits out a getter that resolves the key after the challenge already started', async () => {
    const handleNextAction = vi.fn(async () => ({
      paymentIntent: { status: 'succeeded' }
    }))
    h.loadStripe.mockResolvedValue({ handleNextAction })
    let resolveKey: (key: string) => void = () => undefined
    const port = createDeferredStripeChallengePort(
      () =>
        new Promise((resolve) => {
          resolveKey = resolve
        })
    )

    const pending = port.handleNextAction('secret')
    resolveKey('pk_server')
    const result = await pending

    expect(result).toEqual({ paymentIntent: { status: 'succeeded' } })
    expect(h.loadStripe).toHaveBeenCalledWith('pk_server')
  })
})

describe('leavesPage', () => {
  beforeEach(() => {
    h.loadStripe.mockReset()
  })

  it.for<{ name: string; retrieved: unknown; leaves: boolean }>([
    {
      name: 'a challenge Stripe runs in the page',
      retrieved: { paymentIntent: { next_action: { type: 'use_stripe_sdk' } } },
      leaves: false
    },
    {
      name: 'an Alipay redirect',
      retrieved: {
        paymentIntent: { next_action: { type: 'alipay_handle_redirect' } }
      },
      leaves: true
    },
    {
      name: "a bank's own page",
      retrieved: {
        paymentIntent: { next_action: { type: 'redirect_to_url' } }
      },
      leaves: true
    },
    {
      name: 'an intent Stripe would not return',
      retrieved: { error: { code: 'resource_missing' } },
      leaves: true
    }
  ])(
    'reads $name as leaving the page: $leaves',
    async ({ retrieved, leaves }) => {
      const retrievePaymentIntent = vi.fn(async () => retrieved)
      h.loadStripe.mockResolvedValue({ retrievePaymentIntent })
      const port = createDeferredStripeChallengePort(() => 'pk_server')

      await expect(port.leavesPage('cs_reload')).resolves.toBe(leaves)
      expect(retrievePaymentIntent).toHaveBeenCalledWith('cs_reload')
    }
  )

  it('reads a provider that never loaded as leaving the page', async () => {
    const port = createDeferredStripeChallengePort(() => undefined)

    await expect(port.leavesPage('cs_reload')).resolves.toBe(true)
  })
})
