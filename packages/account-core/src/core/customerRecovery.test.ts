import { describe, expect, it, vi } from 'vitest'

import {
  MISSING_CUSTOMER_MESSAGE,
  fetchWithCustomerRecovery,
  isCustomerEndpoint,
  isMissingCustomerResponse
} from './customerRecovery.js'

const BALANCE_URL = 'https://api.test/customers/balance'

function conflict(message = MISSING_CUSTOMER_MESSAGE): Response {
  return new Response(JSON.stringify({ message }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' }
  })
}

function ok(): Response {
  return new Response('{}', { status: 200 })
}

describe('isMissingCustomerResponse', () => {
  it('matches only a 409 carrying the auth middleware message', async () => {
    expect(await isMissingCustomerResponse(conflict())).toBe(true)
    expect(
      await isMissingCustomerResponse(conflict('Subscription already active')),
      'a business conflict must not trigger provisioning or a blind retry'
    ).toBe(false)
    expect(
      await isMissingCustomerResponse(new Response('not json', { status: 409 }))
    ).toBe(false)
    expect(
      await isMissingCustomerResponse(
        new Response(JSON.stringify({ message: MISSING_CUSTOMER_MESSAGE }), {
          status: 404
        })
      )
    ).toBe(false)
  })

  it('leaves the body readable for the caller', async () => {
    const response = conflict()
    await isMissingCustomerResponse(response)
    await expect(response.json()).resolves.toEqual({
      message: MISSING_CUSTOMER_MESSAGE
    })
  })
})

describe('isCustomerEndpoint', () => {
  it('recognises /customers and its sub-paths, absolute or relative to a base', () => {
    expect(isCustomerEndpoint('https://api.test/customers')).toBe(true)
    expect(isCustomerEndpoint(BALANCE_URL)).toBe(true)
    expect(isCustomerEndpoint('/customers/balance', 'https://api.test/')).toBe(
      true
    )
    expect(isCustomerEndpoint('https://api.test/customers-export')).toBe(false)
    expect(isCustomerEndpoint('https://api.test/workflows')).toBe(false)
    expect(isCustomerEndpoint('/customers/balance')).toBe(false)
  })
})

describe('fetchWithCustomerRecovery', () => {
  it('provisions once and retries once on a missing-customer 409', async () => {
    const request = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(conflict())
      .mockResolvedValueOnce(ok())
    const recoverMissingCustomer = vi.fn(async () => {})

    const response = await fetchWithCustomerRecovery(BALANCE_URL, {
      request,
      recoverMissingCustomer
    })

    expect(response.ok).toBe(true)
    expect(recoverMissingCustomer).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('returns the original 409 when provisioning fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const original = conflict()
    const request = vi.fn(async () => original)

    const response = await fetchWithCustomerRecovery(BALANCE_URL, {
      request,
      recoverMissingCustomer: async () => {
        throw new Error('customers endpoint down')
      }
    })

    expect(response).toBe(original)
    expect(request).toHaveBeenCalledOnce()
  })

  it('returns the original 409 when the retry fails at the network level', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const original = conflict()
    const request = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(original)
      .mockRejectedValueOnce(new TypeError('network down'))

    const response = await fetchWithCustomerRecovery(BALANCE_URL, {
      request,
      recoverMissingCustomer: async () => {}
    })

    expect(response).toBe(original)
  })

  it.for([
    ['a non-409 answer', BALANCE_URL, () => ok()],
    [
      'a business 409',
      BALANCE_URL,
      () => conflict('Subscription already active')
    ],
    [
      'a 409 from a non-customer endpoint',
      'https://api.test/workflows',
      () => conflict()
    ]
  ] as const)(
    'passes %s through without provisioning',
    async ([, url, respond]) => {
      const original = respond()
      const recoverMissingCustomer = vi.fn(async () => {})

      const response = await fetchWithCustomerRecovery(url, {
        request: async () => original,
        recoverMissingCustomer
      })

      expect(response).toBe(original)
      expect(recoverMissingCustomer).not.toHaveBeenCalled()
    }
  )

  it('neither provisions nor retries once the identity that started the request is gone', async () => {
    const original = conflict()
    const recoverMissingCustomer = vi.fn(async () => {})

    const response = await fetchWithCustomerRecovery(BALANCE_URL, {
      request: async () => original,
      recoverMissingCustomer,
      identityUnchanged: () => false
    })

    expect(response).toBe(original)
    expect(
      recoverMissingCustomer,
      'provisioning for a signed-out or switched account would create the wrong customer'
    ).not.toHaveBeenCalled()
  })

  it('skips the retry when the identity changes during provisioning', async () => {
    const original = conflict()
    let live = true
    const request = vi.fn(async () => original)

    const response = await fetchWithCustomerRecovery(BALANCE_URL, {
      request,
      recoverMissingCustomer: async () => {
        live = false
      },
      identityUnchanged: () => live
    })

    expect(response).toBe(original)
    expect(request).toHaveBeenCalledOnce()
  })
})
