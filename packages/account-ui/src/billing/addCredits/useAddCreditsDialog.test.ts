import { assert, describe, expect, it } from 'vitest'

import type {
  HostedTopupCheckoutResult,
  TopupCommand,
  TopupQuoteResult
} from '@comfyorg/account-core/billing'
import { readBillingErrorCode } from '@comfyorg/account-core/billing'

import { addCreditsClientPorts } from './useAddCreditsDialog'

function topupAnswering(
  quote: TopupQuoteResult,
  checkout: HostedTopupCheckoutResult
): Pick<TopupCommand, 'quoteTopup' | 'createHostedTopupCheckout'> & {
  returnUrls: string[]
} {
  const returnUrls: string[] = []
  return {
    returnUrls,
    quoteTopup: async () => quote,
    createHostedTopupCheckout: async (input) => {
      returnUrls.push(input.returnUrl)
      return checkout
    }
  }
}

const signal = new AbortController().signal

describe('addCreditsClientPorts', () => {
  it('reads the served credits and the hosted checkout url', async () => {
    const topup = topupAnswering(
      {
        status: 'ok',
        value: { amountCents: 5000, credits: 10550, expiresAt: '2027-01-01' }
      },
      { status: 'ok', url: 'https://checkout.example/cs_1' }
    )
    const ports = addCreditsClientPorts(
      { topup },
      () => 'https://cloud.comfy.org/?topup=return'
    )

    expect(await ports.quote(5000, signal)).toStrictEqual({
      status: 'ok',
      credits: 10550
    })
    expect(await ports.createCheckout(5000, signal)).toStrictEqual({
      status: 'ok',
      url: 'https://checkout.example/cs_1'
    })
    expect(topup.returnUrls).toEqual(['https://cloud.comfy.org/?topup=return'])
  })

  it('turns a 429 into the rate-limit refusal with its wait', async () => {
    const serverCode = readBillingErrorCode({
      code: 'TOPUP_RATE_LIMITED',
      message: 'limit'
    })
    assert.exists(serverCode)
    const topup = topupAnswering(
      { status: 'error', code: 'REQUEST_FAILED' },
      {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 429,
        serverCode,
        retryAfterSeconds: 2400
      }
    )
    const ports = addCreditsClientPorts(
      { topup },
      () => 'https://cloud.comfy.org/'
    )

    expect(await ports.quote(5000, signal)).toStrictEqual({ status: 'error' })
    expect(await ports.createCheckout(5000, signal)).toStrictEqual({
      status: 'error',
      refusal: { kind: 'rate_limited', retryAfterSeconds: 2400 }
    })
  })
})
