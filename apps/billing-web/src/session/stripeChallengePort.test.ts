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
})
