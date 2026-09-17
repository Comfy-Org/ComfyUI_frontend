import { PREVIEW_SUBSCRIBE_ROUTE } from '@comfyorg/account-core/billing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NOW,
  NO_RESPONSE,
  SCOPE_CHANGED,
  createBillingHarness,
  httpOk
} from './__fixtures__/billingHarness'
import { usePreviewSubscribe } from './usePreviewSubscribe'

function quoteBody(planSlug: string, costTodayCents: number) {
  return {
    allowed: true,
    cost_next_period_cents: 2000,
    cost_today_cents: costTodayCents,
    credits_next_period_cents: 2000,
    credits_today_cents: costTodayCents,
    effective_at: '2026-09-15T00:00:00.000Z',
    is_immediate: true,
    new_plan: {
      credits_cents: 2000,
      duration: 'MONTHLY',
      price_cents: 2000,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2000,
        total_credits_cents: 2000
      },
      slug: planSlug,
      tier: 'PRO'
    },
    transition_type: 'upgrade'
  }
}

const CREATOR = quoteBody('creator_monthly', 500)
const PRO = quoteBody('pro_monthly', 1500)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('usePreviewSubscribe', () => {
  it('publishes the quote it asked for and clears it on reset', async () => {
    const { client, answer } = createBillingHarness()
    answer('POST', PREVIEW_SUBSCRIBE_ROUTE, httpOk(PRO))
    const preview = usePreviewSubscribe({ client })

    const quoting = preview.quote({ planSlug: 'pro_monthly' })
    expect(preview.loading.value).toBe(true)
    await quoting

    expect(preview.preview.value).toMatchObject({
      cost_today_cents: 1500n,
      new_plan: { slug: 'pro_monthly' }
    })
    expect(preview.loading.value).toBe(false)

    preview.reset()

    expect(preview.preview.value).toBeUndefined()
  })

  it('abandons the quote in flight when the host asks for another plan', async () => {
    const { client, answer, calls } = createBillingHarness()
    answer('POST', PREVIEW_SUBSCRIBE_ROUTE, httpOk(CREATOR), NO_RESPONSE)
    const preview = usePreviewSubscribe({ client })

    const abandoned = preview.quote({ planSlug: 'creator_monthly' })
    const wanted = preview.quote({ planSlug: 'pro_monthly' })
    await Promise.all([abandoned, wanted])

    const [first] = calls.filter(
      (call) => call.route === PREVIEW_SUBSCRIBE_ROUTE
    )
    expect(first.signal?.aborted).toBe(true)
    expect(
      preview.preview.value,
      'a price for the plan the host moved off never lands on screen'
    ).toBeUndefined()
    expect(preview.failure.value).toEqual(NO_RESPONSE)
  })

  it('drops the quote without reporting a failure when the scope moves under it', async () => {
    const { client, answer } = createBillingHarness()
    answer('POST', PREVIEW_SUBSCRIBE_ROUTE, httpOk(PRO))
    const preview = usePreviewSubscribe({ client })
    await preview.quote({ planSlug: 'pro_monthly' })

    answer('POST', PREVIEW_SUBSCRIBE_ROUTE, SCOPE_CHANGED)
    await expect(
      preview.quote({ planSlug: 'creator_monthly' })
    ).resolves.toEqual(SCOPE_CHANGED)

    expect(
      preview.preview.value,
      'a price for the workspace the host left is not this one'
    ).toBeUndefined()
    expect(
      preview.failure.value,
      'the user did not cause the switch and has nothing to retry'
    ).toBeUndefined()
  })

  it('surfaces a rejected quote without dropping the one on screen', async () => {
    const { client, answer } = createBillingHarness()
    answer('POST', PREVIEW_SUBSCRIBE_ROUTE, httpOk(PRO))
    const preview = usePreviewSubscribe({ client })
    await preview.quote({ planSlug: 'pro_monthly' })

    answer('POST', PREVIEW_SUBSCRIBE_ROUTE, NO_RESPONSE)
    await expect(
      preview.quote({ planSlug: 'creator_monthly' })
    ).resolves.toEqual(NO_RESPONSE)

    expect(preview.failure.value).toEqual(NO_RESPONSE)
    expect(preview.preview.value).toMatchObject({
      new_plan: { slug: 'pro_monthly' }
    })
  })
})
