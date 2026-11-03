import type { BillingTopUpDenial } from './addCreditsAvailability'
import { describe, expect, it } from 'vitest'

import { addCreditsAvailability } from './addCreditsAvailability'

const refused = { resolved: true, canTopUp: false }

describe('addCreditsAvailability', () => {
  it.for<{
    case: string
    facts: {
      resolved: boolean
      canTopUp: boolean
      denial: BillingTopUpDenial | undefined
    }
    expected: ReturnType<typeof addCreditsAvailability>
  }>([
    {
      case: 'an allowed top-up',
      facts: { resolved: true, canTopUp: true, denial: undefined },
      expected: { kind: 'enabled' }
    },
    {
      case: 'capabilities not yet served',
      facts: { resolved: false, canTopUp: false, denial: undefined },
      expected: { kind: 'hidden' }
    },
    {
      case: 'a member who is not the owner',
      facts: { ...refused, denial: 'not_workspace_owner' },
      expected: { kind: 'hidden' }
    },
    {
      case: 'a caller outside the workspace',
      facts: { ...refused, denial: 'not_a_member' },
      expected: { kind: 'hidden' }
    },
    {
      case: 'paused top-up purchases',
      facts: { ...refused, denial: 'topup_purchases_paused' },
      expected: {
        kind: 'disabled',
        reasonKey: 'credits.addCreditsRefusal.topupPurchasesPaused'
      }
    },
    {
      case: 'a past-due payment',
      facts: { ...refused, denial: 'payment_past_due' },
      expected: {
        kind: 'disabled',
        reasonKey: 'credits.addCreditsRefusal.paymentPastDue'
      }
    },
    {
      case: 'another served refusal',
      facts: { ...refused, denial: 'creator_only_provisioning' },
      expected: {
        kind: 'disabled',
        reasonKey: 'credits.addCreditsRefusal.unavailable'
      }
    },
    {
      case: 'a refusal with an unrecognized or missing reason',
      facts: { ...refused, denial: undefined },
      expected: {
        kind: 'disabled',
        reasonKey: 'credits.addCreditsRefusal.unavailable'
      }
    }
  ])('renders $case as $expected.kind', ({ facts, expected }) => {
    expect(addCreditsAvailability(facts)).toEqual(expected)
  })
})
