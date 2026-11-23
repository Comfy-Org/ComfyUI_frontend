import { describe, expect, it } from 'vitest'

import { decodeCapabilityDenials } from './capabilityDenials'

describe('decodeCapabilityDenials', () => {
  it.for([
    { reason: 'topup_purchases_paused', decoded: 'topup_purchases_paused' },
    { reason: 'payment_past_due', decoded: 'payment_past_due' },
    { reason: 'a_branch_this_client_predates', decoded: 'unspecified' }
  ])('decodes can_top_up reason $reason as $decoded', ({ reason, decoded }) => {
    expect(decodeCapabilityDenials({ can_top_up: reason })).toEqual({
      can_top_up: decoded
    })
  })
})
