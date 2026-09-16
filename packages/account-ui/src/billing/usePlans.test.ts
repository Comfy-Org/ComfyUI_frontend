import { PLANS_ROUTE } from '@comfyorg/account/billing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NOW,
  NO_RESPONSE,
  createBillingHarness
} from './__fixtures__/billingHarness'
import { usePlans } from './usePlans'

const CATALOG = {
  current_plan_slug: 'free',
  plans: [{ slug: 'creator_monthly', price_cents: 2000n }]
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('usePlans', () => {
  it('reads the catalog on setup and keeps the last one through a failed refresh', async () => {
    const { client, answer } = createBillingHarness()

    const plans = usePlans({ client })
    expect(plans.loading.value).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(plans.plans.value).toMatchObject(CATALOG)
    expect(plans.loading.value).toBe(false)

    answer('GET', PLANS_ROUTE, NO_RESPONSE)
    await expect(plans.refresh()).resolves.toEqual(NO_RESPONSE)
    expect(
      plans.plans.value,
      'an unreachable backend is not an empty catalog'
    ).toMatchObject(CATALOG)
    expect(plans.failure.value).toEqual(NO_RESPONSE)
  })

  it('leaves the first read to the host when it is not immediate', async () => {
    const { client, routes } = createBillingHarness()

    const plans = usePlans({ client, immediate: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(plans.plans.value).toBeUndefined()
    expect(routes()).toEqual([])

    await plans.refresh()

    expect(plans.plans.value).toMatchObject(CATALOG)
  })
})
