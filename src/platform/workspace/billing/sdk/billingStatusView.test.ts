import type { BillingStatusData } from '@comfyorg/account-core/billing'
import { describe, expect, it } from 'vitest'

import { projectBillingStatus } from './billingStatusView'

const CURRENT_STOP = {
  id: 'team_200',
  credits_monthly: 20_000n,
  stop_usd: 200n
}
const SCHEDULED_STOP = {
  id: 'team_500',
  credits_monthly: 50_000n,
  stop_usd: 500n
}
const SCHEDULED_CHANGE = {
  effective_at: '2026-10-01T00:00:00.000Z',
  plan_slug: 'team_monthly',
  team_credit_stop: SCHEDULED_STOP
}
const TOO_LARGE = BigInt(Number.MAX_SAFE_INTEGER) + 1n

const DECODED: BillingStatusData = {
  is_active: true,
  has_funds: true,
  max_seats: 5,
  occupied_seats: 2,
  subscription_tier: 'TEAM',
  team_credit_stop: CURRENT_STOP,
  scheduled_change: SCHEDULED_CHANGE
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

  it.for([
    {
      field: 'current credits_monthly',
      status: {
        ...DECODED,
        team_credit_stop: { ...CURRENT_STOP, credits_monthly: TOO_LARGE }
      }
    },
    {
      field: 'current stop_usd',
      status: {
        ...DECODED,
        team_credit_stop: { ...CURRENT_STOP, stop_usd: TOO_LARGE }
      }
    },
    {
      field: 'scheduled credits_monthly',
      status: {
        ...DECODED,
        scheduled_change: {
          ...SCHEDULED_CHANGE,
          team_credit_stop: { ...SCHEDULED_STOP, credits_monthly: TOO_LARGE }
        }
      }
    },
    {
      field: 'scheduled stop_usd',
      status: {
        ...DECODED,
        scheduled_change: {
          ...SCHEDULED_CHANGE,
          team_credit_stop: { ...SCHEDULED_STOP, stop_usd: TOO_LARGE }
        }
      }
    }
  ])(
    'refuses a $field a number cannot hold exactly instead of rounding it',
    ({ status }) => {
      expect(projectBillingStatus(status)).toBeUndefined()
    }
  )

  it('carries a status with no credit stop and no scheduled change through untouched', () => {
    const plain: BillingStatusData = {
      ...DECODED,
      team_credit_stop: null,
      scheduled_change: null
    }

    expect(projectBillingStatus(plain)).toStrictEqual(plain)
  })
})
