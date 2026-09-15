import { describe, expect, it, vi } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import { TopUpCheckoutError, createTopUpCheckout } from './buy-credits'

const options = {
  token: 'fresh-token',
  amountCents: 5_000,
  returnUrl: 'https://comfy.org/models/foo?workshopTopUpReturn=attempt-1',
  idempotencyKey: 'attempt-1'
}

describe('createTopUpCheckout', () => {
  it('sends the captured checkout request and returns the Stripe session', async () => {
    const fetchCheckout = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checkout_url: 'https://checkout.stripe.com/c/pay_1',
          session_id: 'cs_1'
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchCheckout)

    await expect(createTopUpCheckout(options)).resolves.toEqual({
      url: 'https://checkout.stripe.com/c/pay_1',
      sessionId: 'cs_1'
    })

    const [target, init] = fetchCheckout.mock.calls[0] as [URL, RequestInit]
    expect(String(target)).toBe(
      `${WORKSHOP_CLOUD_BASE_URL}/api/billing/topup/checkout`
    )
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer fresh-token',
        'Content-Type': 'application/json'
      }
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(String(init.body))).toEqual({
      amount_cents: 5_000,
      return_url: options.returnUrl,
      idempotency_key: 'attempt-1'
    })
  })

  it('accepts the Comfy custom checkout domain', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            checkout_url: 'https://checkout.comfy.org/c/pay_1',
            session_id: 'cs_2'
          }),
          { status: 200 }
        )
      )
    )

    await expect(createTopUpCheckout(options)).resolves.toEqual({
      url: 'https://checkout.comfy.org/c/pay_1',
      sessionId: 'cs_2'
    })
  })

  it.for([
    'not a URL',
    'http://checkout.stripe.com/c/pay_1',
    'https://stripe.example.com/c/pay_1',
    'https://checkout.stripe.com.evil.test/c/pay_1',
    'https://checkout.comfy.org.evil.test/c/pay_1',
    'https://user@checkout.stripe.com/c/pay_1',
    'https://checkout.stripe.com:444/c/pay_1'
  ])('rejects an unsafe checkout URL: %s', async (checkoutUrl) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ checkout_url: checkoutUrl }), {
          status: 200
        })
      )
    )

    await expect(createTopUpCheckout(options)).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE'
    })
  })

  it('preserves the API error code for rollout decisions', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ code: 'NOT_FOUND', message: 'Not found' }),
            { status: 404 }
          )
        )
    )

    const result = createTopUpCheckout(options)
    await expect(result).rejects.toBeInstanceOf(TopUpCheckoutError)
    await expect(result).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND'
    })
  })

  it('does not infer a rollout code from an empty 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 404 }))
    )

    await expect(createTopUpCheckout(options)).rejects.toMatchObject({
      status: 404,
      code: undefined
    })
  })
})
