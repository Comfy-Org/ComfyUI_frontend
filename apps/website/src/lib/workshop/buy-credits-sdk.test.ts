import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { describe, expect, it, vi } from 'vitest'

import type { HostedTopupCheckoutResult } from '@comfyorg/account-core/billing'

import { workshopTopupCommand } from '@/config/workshop-billing-sdk'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { readBillingSdkTopupEnabled } from '@/config/workshop-features'
import { TopUpCheckoutError } from './buy-credits'
import { createWorkshopTopUpCheckout } from './buy-credits-sdk'

vi.mock(import('@/config/workshop-billing-sdk'))
vi.mock(import('@/config/workshop-features'))

const options = {
  token: 'fresh-token',
  amountCents: 5_000,
  idempotencyKey: 'attempt-1'
}

const legacySession = {
  checkout_url: 'https://checkout.stripe.com/c/legacy',
  session_id: 'cs_legacy'
}

function stubLegacyCheckout() {
  respondToFetch(
    {
      method: 'POST',
      url: `${WORKSHOP_CLOUD_BASE_URL}/api/billing/topup/checkout`
    },
    () => Response.json(legacySession)
  )
}

describe('createWorkshopTopUpCheckout', () => {
  it('uses the site request while the flag is off', async () => {
    stubLegacyCheckout()

    await expect(createWorkshopTopUpCheckout(options)).resolves.toEqual({
      url: legacySession.checkout_url,
      sessionId: legacySession.session_id
    })
    expect(fetch).toHaveBeenCalledOnce()
    expect(
      workshopTopupCommand().createHostedTopupCheckout
    ).not.toHaveBeenCalled()
  })

  it('opens the SDK session while the flag is on', async () => {
    vi.mocked(readBillingSdkTopupEnabled).mockResolvedValue(true)
    vi.mocked(
      workshopTopupCommand().createHostedTopupCheckout
    ).mockResolvedValue({
      status: 'ok',
      url: 'https://checkout.comfy.org/c/sdk',
      sessionId: 'cs_sdk',
      baselineMicros: 1_000
    })

    await expect(createWorkshopTopUpCheckout(options)).resolves.toEqual({
      url: 'https://checkout.comfy.org/c/sdk',
      sessionId: 'cs_sdk'
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(
      workshopTopupCommand().createHostedTopupCheckout
    ).toHaveBeenCalledWith({
      amountCents: 5_000,
      returnUrl: new URL(
        '/checkout-return?workshopTopUpReturn=attempt-1',
        window.location.origin
      ).toString()
    })
  })

  it('falls back to the site request when the SDK route is not deployed', async () => {
    stubLegacyCheckout()
    vi.mocked(readBillingSdkTopupEnabled).mockResolvedValue(true)
    vi.mocked(
      workshopTopupCommand().createHostedTopupCheckout
    ).mockResolvedValue({
      status: 'error',
      code: 'NOT_AVAILABLE'
    })

    await expect(createWorkshopTopUpCheckout(options)).resolves.toEqual({
      url: legacySession.checkout_url,
      sessionId: legacySession.session_id
    })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it.for([
    {
      failure: {
        status: 'error',
        code: 'ACCESS_DENIED',
        httpStatus: 403
      } satisfies HostedTopupCheckoutResult,
      expected: { status: 403, code: 'ACCESS_DENIED' }
    },
    {
      failure: {
        status: 'error',
        code: 'REQUEST_FAILED'
      } satisfies HostedTopupCheckoutResult,
      expected: { status: 0, code: 'REQUEST_FAILED' }
    },
    {
      failure: {
        status: 'error',
        code: 'INVALID_AMOUNT'
      } satisfies HostedTopupCheckoutResult,
      expected: { status: 0, code: 'INVALID_AMOUNT' }
    },
    {
      failure: {
        status: 'error',
        code: 'INVALID_RETURN_URL'
      } satisfies HostedTopupCheckoutResult,
      expected: { status: 0, code: 'INVALID_RETURN_URL' }
    },
    {
      failure: {
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: 200
      } satisfies HostedTopupCheckoutResult,
      expected: { status: 200, code: 'MALFORMED_RESPONSE' }
    }
  ])('surfaces $failure.code to the dialog', async ({ failure, expected }) => {
    vi.mocked(readBillingSdkTopupEnabled).mockResolvedValue(true)
    vi.mocked(
      workshopTopupCommand().createHostedTopupCheckout
    ).mockResolvedValue(failure)

    const checkout = createWorkshopTopUpCheckout(options)
    await expect(checkout).rejects.toBeInstanceOf(TopUpCheckoutError)
    await expect(checkout).rejects.toMatchObject(expected)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.for([
    'https://checkout.stripe.evil.test/c/sdk',
    'https://checkout.stripe.com:444/c/sdk',
    'https://user@checkout.comfy.org/c/sdk'
  ])('rejects an SDK checkout URL outside the allowlist: %s', async (url) => {
    vi.mocked(readBillingSdkTopupEnabled).mockResolvedValue(true)
    vi.mocked(
      workshopTopupCommand().createHostedTopupCheckout
    ).mockResolvedValue({ status: 'ok', url })

    await expect(createWorkshopTopUpCheckout(options)).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE'
    })
  })
})
