import { describe, expect, it } from 'vitest'

import type { BillingRail } from '@/platform/workspace/api/workspaceApi'

import { getBillingRailPolicy } from './billingRailPolicy'

describe('getBillingRailPolicy', () => {
  it('keeps legacy_stripe on legacy account operations without Churnkey', () => {
    expect(getBillingRailPolicy('legacy_stripe')).toEqual({
      usesLegacyAccountOperations: true,
      supportsChurnkeyCancellation: false
    })
  })

  it('serves stripe from workspace billing with Churnkey cancellation', () => {
    expect(getBillingRailPolicy('stripe')).toEqual({
      usesLegacyAccountOperations: false,
      supportsChurnkeyCancellation: true
    })
  })

  it('serves metronome from workspace billing without Churnkey', () => {
    expect(getBillingRailPolicy('metronome')).toEqual({
      usesLegacyAccountOperations: false,
      supportsChurnkeyCancellation: false
    })
  })

  it.for([null, undefined])(
    'fails open to workspace billing without Churnkey when the rail is %s',
    (rail) => {
      expect(getBillingRailPolicy(rail)).toEqual({
        usesLegacyAccountOperations: false,
        supportsChurnkeyCancellation: false
      })
    }
  )

  it('fails open for a rail value this build does not recognize', () => {
    // This cast tests runtime fallback; `satisfies never` guards type widening.
    expect(getBillingRailPolicy('adyen' as BillingRail)).toEqual({
      usesLegacyAccountOperations: false,
      supportsChurnkeyCancellation: false
    })
  })
})
