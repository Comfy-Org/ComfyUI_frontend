import { describe, expect, it, vi } from 'vitest'

import {
  WORKSHOP_CLOUD_BASE_URL,
  WORKSHOP_CREDITS_URL
} from '../../config/workshop-env'
import { TopUpCheckoutError, createTopUpCheckout } from './buy-credits'

const options = {
  token: 'fresh-token',
  amountCents: 5_000,
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
      return_url: new URL(
        '/checkout-return?workshopTopUpReturn=attempt-1',
        window.location.origin
      ).toString(),
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

  it('uses the Cloud credits page as the server-side return URL', async () => {
    const fetchCheckout = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checkout_url: 'https://checkout.stripe.com/c/pay_1'
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchCheckout)
    vi.stubGlobal('window', undefined)

    await createTopUpCheckout(options)

    const [, init] = fetchCheckout.mock.calls[0] as [URL, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      return_url: WORKSHOP_CREDITS_URL
    })
  })

  it('returns a Chinese checkout through the localized return page', async () => {
    const fetchCheckout = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checkout_url: 'https://checkout.stripe.com/c/pay_1'
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchCheckout)

    await createTopUpCheckout({ ...options, locale: 'zh-CN' })

    const [, init] = fetchCheckout.mock.calls[0] as [URL, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      return_url: new URL(
        '/zh-CN/checkout-return?workshopTopUpReturn=attempt-1',
        window.location.origin
      ).toString()
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

  it('retries a 404 return-host rejection through the Cloud credits page', async () => {
    const fetchCheckout = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            checkout_url: 'https://checkout.stripe.com/c/pay_2'
          }),
          { status: 200 }
        )
      )
    vi.stubGlobal('fetch', fetchCheckout)

    await expect(createTopUpCheckout(options)).resolves.toEqual({
      url: 'https://checkout.stripe.com/c/pay_2'
    })
    expect(
      fetchCheckout.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
    ).toEqual([
      {
        amount_cents: 5_000,
        return_url: new URL(
          '/checkout-return?workshopTopUpReturn=attempt-1',
          window.location.origin
        ).toString(),
        idempotency_key: 'attempt-1'
      },
      {
        amount_cents: 5_000,
        return_url: WORKSHOP_CREDITS_URL,
        idempotency_key: 'attempt-1'
      }
    ])
  })

  it.for([400, 500])('does not retry a %s checkout failure', async (status) => {
    const fetchCheckout = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status }))
    vi.stubGlobal('fetch', fetchCheckout)

    await expect(createTopUpCheckout(options)).rejects.toMatchObject({ status })
    expect(fetchCheckout).toHaveBeenCalledOnce()
  })

  it('preserves the API error code for rollout decisions', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(
              JSON.stringify({ code: 'NOT_FOUND', message: 'Not found' }),
              { status: 404 }
            )
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

  it('surfaces a 401 without reminting or retrying', async () => {
    const fetchCheckout = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ code: 'NOT_AUTHENTICATED', message: 'Expired' }),
          { status: 401 }
        )
      )
    vi.stubGlobal('fetch', fetchCheckout)

    const result = createTopUpCheckout(options)
    await expect(result).rejects.toBeInstanceOf(TopUpCheckoutError)
    await expect(result).rejects.toMatchObject({
      status: 401,
      code: 'NOT_AUTHENTICATED'
    })
    await expect(result).rejects.not.toHaveProperty(
      'authenticationRetrySkipped'
    )
    expect(fetchCheckout).toHaveBeenCalledTimes(1)
  })

  it('does not infer a rollout code from an empty 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response('', { status: 404 }))
        )
    )

    await expect(createTopUpCheckout(options)).rejects.toMatchObject({
      status: 404,
      code: undefined
    })
  })
})
