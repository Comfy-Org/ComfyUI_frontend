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

import type { AddCreditsCheckoutTab } from './useAddCreditsDialog'
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

describe('a single-use checkout', () => {
  function singleUseDialog(tabs: (AddCreditsCheckoutTab | null)[]) {
    const createCheckout = vi.fn(async () => ({
      status: 'ok' as const,
      url: 'https://billing.test/handoff#token=once'
    }))
    const scope = effectScope()
    const dialog = scope.run(() =>
      useAddCreditsDialog({
        ports: {
          quote: async () => ({ status: 'error' }),
          createCheckout,
          reserveTab: () => tabs.shift() ?? null,
          watchPayment: () => () => {},
          singleUseCheckout: true
        },
        facts: { bounds: ADD_CREDITS_FALLBACK_BOUNDS, canTopUp: true },
        initialAmount: initialAddCreditsAmount(null)
      })
    )
    assert(dialog)
    return { dialog, createCheckout }
  }

  it('creates none while the browser blocks the tab, and never keeps its URL', async () => {
    const { dialog, createCheckout } = singleUseDialog([null])

    await dialog.continueToCheckout()

    expect(createCheckout).not.toHaveBeenCalled()
    expect(dialog.state.value).toStrictEqual({
      step: 'checkout_blocked',
      amount: { kind: 'preset', cents: 5000 },
      amountCents: 5000
    })
  })

  it('creates a fresh one in the blocked step click and opens it in that tab', async () => {
    const navigate = vi.fn()
    const { dialog, createCheckout } = singleUseDialog([
      null,
      { navigate, close: () => {} }
    ])
    await dialog.continueToCheckout()

    await dialog.reopenCheckout()

    expect(createCheckout).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      'https://billing.test/handoff#token=once'
    )
    expect(dialog.state.value.step).toBe('checkout_opened')
  })
})
