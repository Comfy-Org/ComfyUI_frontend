import { describe, expect, it } from 'vitest'

import type { BillingStatusData } from '@comfyorg/account-core/billing'

import { projectBillingStatus } from './billingStatusView'

const DECODED: BillingStatusData = {
  is_active: true,
  has_funds: true,
  max_seats: 5,
  occupied_seats: 2,
  subscription_tier: 'TEAM',
  team_credit_stop: {
    id: 'team_200',
    credits_monthly: 20_000n,
    stop_usd: 200n
  },
  scheduled_change: {
    effective_at: '2026-10-01T00:00:00.000Z',
    plan_slug: 'team_monthly',
    team_credit_stop: {
      id: 'team_500',
      credits_monthly: 50_000n,
      stop_usd: 500n
    }
  }
}

describe('projectBillingStatus', () => {
  it('reads the credit stop int64s back as the numbers the host holds', () => {
    const projected = projectBillingStatus(DECODED)

    expect(projected?.team_credit_stop).toStrictEqual({
      id: 'team_200',
      credits_monthly: 20_000,
      stop_usd: 200
    })
    expect(projected?.scheduled_change?.team_credit_stop).toStrictEqual({
      id: 'team_500',
      credits_monthly: 50_000,
      stop_usd: 500
    })
    expect(projected?.scheduled_change?.plan_slug).toBe('team_monthly')
  })

  it('refuses a credit stop a number cannot hold exactly instead of rounding it', () => {
    const tooLarge: BillingStatusData = {
      ...DECODED,
      team_credit_stop: {
        id: 'team_huge',
        credits_monthly: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        stop_usd: 200n
      }
    }

    expect(projectBillingStatus(tooLarge)).toBeUndefined()
  })

  it('carries a status with no credit stop and no scheduled change through untouched', () => {
    const plain: BillingStatusData = {
      ...DECODED,
      team_credit_stop: null,
      scheduled_change: null
    }

    expect(projectBillingStatus(plain)).toStrictEqual(plain)
  })
})
