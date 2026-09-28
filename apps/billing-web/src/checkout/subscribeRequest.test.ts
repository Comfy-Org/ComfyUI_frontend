import type {
  SubscribeInput,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import type { BillingEntry } from '@comfyorg/billing-contract'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import { buildSubscribeRequest } from '@/checkout/subscribeRequest'
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
