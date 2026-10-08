import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import type {
  BillingHttpResponse,
  BillingResult
} from '@comfyorg/account-core/billing'

import {
  BASELINE_MICROS,
  NO_RESPONSE,
  NOW,
  balance,
  createBillingHarness,
  httpOk
} from './__fixtures__/billingHarness'
import { provideBillingClient } from './billingClient'
import { useCredits } from './useCredits'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

const SWITCHED_MICROS = 7_500_000

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('useCredits', () => {
  it('reads the balance on setup and keeps the last one through a failed refresh', async () => {
    const { client, answer } = createBillingHarness({
      balances: [BASELINE_MICROS]
    })

    const credits = useCredits({ client })
    expect(credits.loading.value).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(credits.balance.value).toEqual(balance(BASELINE_MICROS))
    expect(credits.loading.value).toBe(false)

    answer('GET', '/billing/balance', NO_RESPONSE)
    await expect(credits.refresh()).resolves.toEqual(NO_RESPONSE)
    expect(
      credits.balance.value,
      'an unreachable backend is not a zero balance'
    ).toEqual(balance(BASELINE_MICROS))
    expect(credits.failure.value).toEqual(NO_RESPONSE)
  })

  it('drops the balance without reporting a failure when the host changes workspace', async () => {
    const { client, moveToWorkspace } = createBillingHarness({
      balances: [BASELINE_MICROS]
    })

    const credits = useCredits({ client })
    await vi.advanceTimersByTimeAsync(0)
    expect(credits.balance.value).toEqual(balance(BASELINE_MICROS))

    const superseded = credits.refresh()
    moveToWorkspace('ws-2')
    await expect(superseded).resolves.toEqual({
      status: 'error',
      code: 'SUPERSEDED'
    })

    expect(
      credits.balance.value,
      'these credits belong to the workspace the host left'
    ).toBeUndefined()
    expect(
      credits.failure.value,
      'the user did not cause the switch and has nothing to retry'
    ).toBeUndefined()
  })

  it('keeps the balance of the workspace moved to when the read it replaced settles last', async () => {
    const { client, answer, moveToWorkspace } = createBillingHarness()
    const held = deferred<BillingResult<BillingHttpResponse>>()
    answer(
      'GET',
      '/billing/balance',
      held.promise,
      httpOk(balance(SWITCHED_MICROS))
    )

    const credits = useCredits({ client, immediate: false })
    const superseded = credits.refresh()
    await vi.advanceTimersByTimeAsync(0)
    moveToWorkspace('ws-2')
    await expect(credits.refresh()).resolves.toMatchObject({ status: 'ok' })
    expect(credits.balance.value).toEqual(balance(SWITCHED_MICROS))

    held.resolve(httpOk(balance(BASELINE_MICROS)))
    await expect(superseded).resolves.toEqual({
      status: 'error',
      code: 'SUPERSEDED'
    })

    expect(
      credits.balance.value,
      'the switch that superseded the slower read is the one already on screen'
    ).toEqual(balance(SWITCHED_MICROS))
    expect(credits.failure.value).toBeUndefined()
  })

  it('resolves the client from the nearest provider when none is passed', async () => {
    const { client } = createBillingHarness({ balances: [BASELINE_MICROS] })
    const Child = defineComponent({
      setup() {
        const { balance: current } = useCredits()
        return () => h('output', current.value?.amount_micros ?? 'none')
      }
    })
    const Parent = defineComponent({
      setup() {
        provideBillingClient(client)
        return () => h(Child)
      }
    })

    render(Parent)
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    expect(screen.getByRole('status').textContent).toBe(String(BASELINE_MICROS))
  })
})
