import { PAYMENT_METHODS_ROUTE } from '@comfyorg/account/billing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NOW,
  SAVED_CARDS,
  createBillingHarness,
  httpOk
} from './__fixtures__/billingHarness'
import { usePaymentMethods } from './usePaymentMethods'

const ADDED_CARD = {
  brand: 'visa',
  id: 'pm_3',
  is_default: true,
  last4: '0005',
  type: 'card'
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('usePaymentMethods', () => {
  it('reads the saved cards on setup and names the default one', async () => {
    const { client } = createBillingHarness()

    const paymentMethods = usePaymentMethods({ client })
    await vi.advanceTimersByTimeAsync(0)

    expect(paymentMethods.methods.value).toEqual(SAVED_CARDS)
    expect(paymentMethods.defaultMethod.value).toEqual(
      SAVED_CARDS.find((card) => card.id === 'pm_2')
    )
    expect(paymentMethods.loading.value).toBe(false)
  })

  it('drops the cards without reporting a failure when the host changes workspace', async () => {
    const { client, moveToWorkspace } = createBillingHarness()
    const paymentMethods = usePaymentMethods({ client })
    await vi.advanceTimersByTimeAsync(0)
    expect(paymentMethods.methods.value).toEqual(SAVED_CARDS)

    const superseded = paymentMethods.refresh()
    moveToWorkspace('ws-2')
    await expect(superseded).resolves.toEqual({
      status: 'error',
      code: 'SUPERSEDED'
    })

    expect(
      paymentMethods.methods.value,
      'the workspace the host moved to cannot charge these cards'
    ).toBeUndefined()
    expect(paymentMethods.defaultMethod.value).toBeUndefined()
    expect(
      paymentMethods.failure.value,
      'the user did not cause the switch and has nothing to retry'
    ).toBeUndefined()
  })

  it('drops the cards it holds and re-reads them after a portal round trip', async () => {
    const { client, answer, routes } = createBillingHarness()
    const paymentMethods = usePaymentMethods({ client })
    await vi.advanceTimersByTimeAsync(0)
    answer('GET', PAYMENT_METHODS_ROUTE, httpOk([ADDED_CARD]))

    const reread = paymentMethods.invalidateAndRefresh()

    expect(
      usePaymentMethods({ client, immediate: false }).methods.value,
      'the portal may have removed a card the dropped list still names'
    ).toBeUndefined()
    await reread
    expect(paymentMethods.methods.value).toEqual([ADDED_CARD])
    expect(
      routes().filter((route) => route.endsWith(PAYMENT_METHODS_ROUTE))
    ).toHaveLength(2)
  })
})
