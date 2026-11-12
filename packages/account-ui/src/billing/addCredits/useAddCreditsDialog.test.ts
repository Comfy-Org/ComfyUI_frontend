import { assert, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type {
  HostedTopupCheckoutResult,
  TopupCommand,
  TopupQuoteResult
} from '@comfyorg/account-core/billing'
import {
  ADD_CREDITS_FALLBACK_BOUNDS,
  initialAddCreditsAmount,
  readBillingErrorCode
} from '@comfyorg/account-core/billing'

import {
  addCreditsClientPorts,
  useAddCreditsDialog
} from './useAddCreditsDialog'

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

describe('useAddCreditsDialog', () => {
  it('ignores an auto top-up offer read that settles after its scope is disposed', async () => {
    let landed = () => {}
    let answerOffer: (url: string | null) => void = () => {}
    const onLanded = vi.fn()
    const scope = effectScope()
    const dialog = scope.run(() =>
      useAddCreditsDialog({
        ports: {
          quote: () => Promise.resolve({ status: 'error' }),
          createCheckout: () =>
            Promise.resolve({ status: 'ok', url: 'https://checkout.test' }),
          reserveTab: () => ({ navigate: () => {}, close: () => {} }),
          watchPayment: (onPayment) => {
            landed = onPayment
            return () => {}
          },
          autoTopUpSetupUrl: () =>
            new Promise((resolve) => {
              answerOffer = resolve
            })
        },
        facts: { bounds: ADD_CREDITS_FALLBACK_BOUNDS, canTopUp: true },
        initialAmount: initialAddCreditsAmount(null),
        onLanded
      })
    )
    assert(dialog)
    await dialog.continueToCheckout()
    await vi.waitFor(() =>
      expect(dialog.state.value.step).toBe('checkout_opened')
    )

    landed()
    scope.stop()
    answerOffer(null)
    await new Promise((resolve) => setTimeout(resolve))

    expect(onLanded).not.toHaveBeenCalled()
    expect(dialog.state.value.step).toBe('checkout_opened')
  })
})
