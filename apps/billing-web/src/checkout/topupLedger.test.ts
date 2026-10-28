import { buildTopupLedger } from '@/checkout/topupLedger'
import { createBillingI18n } from '@/i18n'

const { t } = createBillingI18n().global

const QUOTE = {
  amountCents: 2500,
  credits: 5275,
  expiresAt: '2027-09-30T12:00:00.000Z'
}

describe('buildTopupLedger', () => {
  it('265-4362: leads with the credits the server quotes, and dates their expiry from the quote', () => {
    expect(
      buildTopupLedger(QUOTE, { workspace: 'Comfy Studios', t, locale: 'en' })
    ).toEqual({
      family: 'top_up',
      eyebrow: 'Add credits · Comfy Studios',
      headline: { amount: '5,275', currency: 'credits', icon: 'coins' },
      items: [
        {
          label: 'Credits',
          amount: '$25.00',
          sublines: ['Expire September 30, 2027']
        }
      ],
      discounts: [],
      chips: [],
      acceptsPromo: false,
      total: '$25.00',
      trailing: []
    })
  })

  it('names only the action when the session has no workspace', () => {
    expect(
      buildTopupLedger(QUOTE, { workspace: undefined, t, locale: 'en' }).eyebrow
    ).toBe('Add credits')
  })
})
