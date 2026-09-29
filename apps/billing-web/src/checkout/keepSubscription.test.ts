import type { SubscriptionPreview } from '@comfyorg/account-core/billing'

import { keepSubscriptionCopy } from '@/checkout/keepSubscription'
import { createBillingI18n } from '@/i18n'
import { previewOf } from '@/test/fakeBillingClient'

const { t } = createBillingI18n().global

const context = {
  tierName: (tier: string) => tier[0] + tier.slice(1).toLowerCase(),
  t: (key: string, named: Record<string, unknown>) => t(key, named),
  locale: 'en-US'
}

const CANCEL_AT = '2026-07-28T00:00:00.000Z'

const team = (tier: 'TEAM' | 'PRO') =>
  ({ ...previewOf().new_plan, tier }) as SubscriptionPreview['new_plan']

describe('keepSubscriptionCopy', () => {
  it.for<{
    name: string
    quote: Partial<SubscriptionPreview>
    body: string
  }>([
    {
      name: 'an upgrade charged today',
      quote: { transition_type: 'upgrade', cost_next_period_cents: 10_000 },
      body: 'Upgrading keeps your subscription, and it renews that day at $100.00.'
    },
    {
      name: 'a downgrade scheduled for period end',
      quote: { transition_type: 'downgrade', renewal_amount_cents: 1200 },
      body: 'Switching to Creator Plan keeps your subscription, and it renews that day at $12.00.'
    },
    {
      name: 'monthly to yearly, which starts a new year',
      quote: {
        transition_type: 'duration_change',
        new_plan: { ...previewOf().new_plan, duration: 'ANNUAL' },
        renewal_at: '2027-07-28T00:00:00.000Z',
        cost_next_period_cents: 30_000
      },
      body: 'Switching to yearly keeps your subscription. It renews on July 28, 2027 at $300.00.'
    },
    {
      name: 'monthly to yearly on a quote that names no renewal date',
      quote: {
        transition_type: 'duration_change',
        new_plan: { ...previewOf().new_plan, duration: 'ANNUAL' },
        cost_next_period_cents: 30_000
      },
      body: 'Switching to yearly keeps your subscription. It renews at $300.00.'
    },
    {
      name: 'yearly to monthly at period end',
      quote: { transition_type: 'duration_change' },
      body: 'Switching to monthly keeps your subscription, and it renews that day at $28.00.'
    },
    {
      name: 'a team commitment change',
      quote: {
        transition_type: 'upgrade',
        new_plan: team('TEAM'),
        current_plan: team('TEAM'),
        cost_next_period_cents: 70_000
      },
      body: 'Changing your commitment keeps your subscription, and it renews that day at $700.00.'
    },
    {
      name: 'a change the quote does not classify',
      quote: { transition_type: 'new_subscription' },
      body: 'This change keeps your subscription, and it renews that day at $28.00.'
    }
  ])('words $name from the quote', ({ quote, body }) => {
    expect(keepSubscriptionCopy(previewOf(quote), CANCEL_AT, context)).toEqual({
      title: 'Your plan was set to end on July 28, 2026',
      body
    })
  })

  it('titles without a date when the status has not answered', () => {
    expect(keepSubscriptionCopy(previewOf(), undefined, context).title).toBe(
      'Your plan was set to end'
    )
  })

  describe('from a zone west of UTC', () => {
    beforeAll(() => {
      process.env.TZ = 'America/Los_Angeles'
    })
    afterAll(() => {
      process.env.TZ = 'UTC'
    })

    it('keeps a midnight-UTC cancel date and renewal on their own day', () => {
      expect(
        keepSubscriptionCopy(
          previewOf({
            transition_type: 'duration_change',
            new_plan: { ...previewOf().new_plan, duration: 'ANNUAL' },
            renewal_at: '2027-07-28T00:00:00.000Z'
          }),
          CANCEL_AT,
          context
        )
      ).toEqual({
        title: 'Your plan was set to end on July 28, 2026',
        body: 'Switching to yearly keeps your subscription. It renews on July 28, 2027 at $28.00.'
      })
    })
  })
})
