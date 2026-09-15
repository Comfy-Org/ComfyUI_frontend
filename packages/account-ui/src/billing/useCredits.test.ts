import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import {
  BASELINE_MICROS,
  NO_RESPONSE,
  NOW,
  balance,
  createBillingHarness
} from './__fixtures__/billingHarness'
import { provideBillingClient } from './billingClient'
import { useCredits } from './useCredits'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

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
