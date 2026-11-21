import type {
  SubscribeInput,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import type { BillingEntry } from '@comfyorg/billing-contract'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import {
  buildSubscribeRequest,
  checkoutReturnUrl
} from '@/checkout/subscribeRequest'
import { previewOf } from '@/test/fakeBillingClient'

function entryOf(query: string): BillingEntry {
  const result = parseBillingEntry(`https://billing.test/v1/checkout?${query}`)
  if (result.status !== 'ok') throw new Error('bad fixture entry')
  return result.entry
}

const arrival = entryOf(
  'product=comfyui&return_to=comfyui_workspace&plan=creator_monthly'
)
const teamArrival = entryOf(
  'product=comfyui&return_to=comfyui_workspace&plan=team_per_credit_annual&team_credit_stop_id=stop_700'
)

describe('checkoutReturnUrl', () => {
  it.for<{ name: string; arrival: BillingEntry }>([
    { name: 'a plan', arrival },
    { name: 'a team credit stop', arrival: teamArrival },
    {
      name: 'a promo prefill',
      arrival: entryOf(
        'product=comfyui&return_to=comfyui_workspace&plan=creator_monthly&promo=LAUNCH20'
      )
    }
  ])('returns to the same request for $name', ({ arrival }) => {
    const url = checkoutReturnUrl(arrival, undefined, 'https://billing.test')
    if (url === undefined) throw new Error('no return URL')

    expect(parseBillingEntry(url)).toEqual({ status: 'ok', entry: arrival })
  })
})

describe('buildSubscribeRequest', () => {
  it.for<{
    name: string
    arrival: BillingEntry
    plan: string
    quoted: SubscriptionPreview
    confirmationToken: string | undefined
    savedPaymentMethodId?: string
    confirmReactivation: boolean
    returnUrl: string | undefined
    expected: SubscribeInput
  }>([
    {
      name: 'a new subscription with the payment token',
      arrival,
      plan: 'creator_monthly',
      quoted: previewOf({ quote_id: 'q_1', quote_version: 3 }),
      confirmationToken: 'ctoken_1',
      confirmReactivation: false,
      returnUrl: 'https://billing.test/v1/result',
      expected: {
        plan_slug: 'creator_monthly',
        confirmation_token: 'ctoken_1',
        quote_id: 'q_1',
        quote_version: 3,
        return_url: 'https://billing.test/v1/result'
      }
    },
    {
      name: 'a quote priced with a promo code echoes the code it bound',
      arrival,
      plan: 'creator_monthly',
      quoted: previewOf({
        quote_id: 'q_3',
        quote_version: 2,
        promotion_code: 'LAUNCH20'
      }),
      confirmationToken: 'ctoken_1',
      confirmReactivation: false,
      returnUrl: undefined,
      expected: {
        plan_slug: 'creator_monthly',
        confirmation_token: 'ctoken_1',
        promotion_code: 'LAUNCH20',
        quote_id: 'q_3',
        quote_version: 2
      }
    },
    {
      name: 'a new subscription charged to a chosen saved method',
      arrival,
      plan: 'creator_monthly',
      quoted: previewOf(),
      confirmationToken: undefined,
      savedPaymentMethodId: 'pm_saved',
      confirmReactivation: false,
      returnUrl: undefined,
      expected: {
        plan_slug: 'creator_monthly',
        saved_payment_method_id: 'pm_saved'
      }
    },
    {
      name: 'a plan change against the saved method, no token',
      arrival,
      plan: 'creator_annual',
      quoted: previewOf({
        transition_type: 'upgrade',
        quote_id: 'q_2',
        quote_version: 7
      }),
      confirmationToken: undefined,
      confirmReactivation: false,
      returnUrl: 'https://billing.test/v1/result',
      expected: {
        plan_slug: 'creator_annual',
        quote_id: 'q_2',
        quote_version: 7,
        return_url: 'https://billing.test/v1/result'
      }
    },
    {
      name: 'an immediate change, priced at the quoted instant',
      arrival,
      plan: 'creator_monthly',
      quoted: previewOf({
        is_immediate: true,
        proration_at: '2026-09-18T12:00:00.000Z'
      }),
      confirmationToken: 'ctoken_1',
      confirmReactivation: false,
      returnUrl: undefined,
      expected: {
        plan_slug: 'creator_monthly',
        confirmation_token: 'ctoken_1',
        proration_at: '2026-09-18T12:00:00.000Z'
      }
    },
    {
      name: 'a change that takes effect later, left unpriced',
      arrival,
      plan: 'creator_monthly',
      quoted: previewOf({
        is_immediate: false,
        proration_at: '2026-09-18T12:00:00.000Z'
      }),
      confirmationToken: 'ctoken_1',
      confirmReactivation: false,
      returnUrl: undefined,
      expected: {
        plan_slug: 'creator_monthly',
        confirmation_token: 'ctoken_1'
      }
    },
    {
      name: "a team plan naming its arrival's credit stop",
      arrival: teamArrival,
      plan: 'team_per_credit_annual',
      quoted: previewOf(),
      confirmationToken: undefined,
      confirmReactivation: false,
      returnUrl: undefined,
      expected: {
        plan_slug: 'team_per_credit_annual',
        team_credit_stop_id: 'stop_700'
      }
    },
    {
      name: 'a confirmed reactivation charge',
      arrival,
      plan: 'creator_monthly',
      quoted: previewOf({ requires_reactivation_confirmation: true }),
      confirmationToken: 'ctoken_1',
      confirmReactivation: true,
      returnUrl: undefined,
      expected: {
        plan_slug: 'creator_monthly',
        confirmation_token: 'ctoken_1',
        confirm_reactivation: true
      }
    },
    {
      name: 'a missing return url, left out of the request',
      arrival,
      plan: 'creator_monthly',
      quoted: previewOf(),
      confirmationToken: undefined,
      confirmReactivation: false,
      returnUrl: undefined,
      expected: { plan_slug: 'creator_monthly' }
    }
  ])(
    '$name',
    ({
      arrival,
      plan,
      quoted,
      confirmationToken,
      savedPaymentMethodId,
      confirmReactivation,
      returnUrl,
      expected
    }) => {
      expect(
        buildSubscribeRequest({
          arrival,
          plan,
          quoted,
          confirmationToken,
          savedPaymentMethodId,
          confirmReactivation,
          returnUrl
        })
      ).toEqual(expected)
    }
  )
})
