import type { TopupQuote } from '@comfyorg/account-core/billing'
import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'

import { longDate } from '@/checkout/longDate'
import type { LedgerContext, SummaryLedger } from '@/checkout/summaryLedger'

const S = 'checkout.fullPage.summary'

/**
 * A credit top-up on the summary column: the credits the server quotes come
 * first, and the one money row is the amount the customer chose, dated by
 * the expiry the server quotes. A top-up takes no promo code.
 */
export function buildTopupLedger(
  quote: TopupQuote,
  { workspace, t, locale }: Omit<LedgerContext, 'tierName'>
): SummaryLedger {
  const action = t(`${S}.verb.topUp`, {})
  const amount = formatQuoteMoney(quote.amountCents, 'usd', locale)
  return {
    family: 'top_up',
    eyebrow:
      workspace === undefined
        ? action
        : t(`${S}.scoped`, { action, workspace }),
    headline: {
      amount: new Intl.NumberFormat(locale).format(quote.credits),
      currency: t(`${S}.credits.bare`, {}),
      icon: 'coins'
    },
    items: [
      {
        label: t(`${S}.item.credits`, {}),
        amount,
        sublines: [
          t(`${S}.item.creditsExpire`, {
            date: longDate(quote.expiresAt, locale)
          })
        ]
      }
    ],
    discounts: [],
    chips: [],
    acceptsPromo: false,
    total: amount,
    trailing: []
  }
}
