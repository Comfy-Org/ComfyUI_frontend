import { describe, expect, it } from 'vitest'

import type { BillingStatusData } from '@comfyorg/account-core/billing'

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
  ended_at: null,
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

  it('reads the renewal invoice amount back as a number', () => {
    const invoice = {
      hosted_invoice_url: 'https://invoice.stripe.com/i/test',
      amount_due: 5000n,
      currency: 'usd'
    }

    expect(
      projectBillingStatus({ ...DECODED, renewal_invoice: invoice })
        ?.renewal_invoice
    ).toStrictEqual({ ...invoice, amount_due: 5000 })
  })

  it('drops only a renewal invoice whose amount a number cannot hold exactly', () => {
    const invoice = {
      hosted_invoice_url: 'https://invoice.stripe.com/i/test',
      amount_due: TOO_LARGE,
      currency: 'usd'
    }

    const projected = projectBillingStatus({
      ...DECODED,
      renewal_invoice: invoice
    })
    expect(projected).toBeDefined()
    expect(projected?.renewal_invoice).toBeUndefined()
  })

  it('reads the period credit grant back as a number', () => {
    const grant = { state: 'amount' as const, credits: 21_100n }

    expect(
      projectBillingStatus({ ...DECODED, period_credit_grant: grant })
        ?.period_credit_grant
    ).toStrictEqual({ state: 'amount', credits: 21_100 })
  })

  it('drops only a period credit grant whose credits a number cannot hold exactly', () => {
    const projected = projectBillingStatus({
      ...DECODED,
      period_credit_grant: { state: 'amount', credits: TOO_LARGE }
    })

    expect(projected).toBeDefined()
    expect(projected?.period_credit_grant).toBeUndefined()
  })

  it('reads the next charge amount back as a number', () => {
    const charge = {
      amount: 2000n,
      currency: 'usd',
      date: '2026-11-27T12:00:00Z',
      reflects_scheduled_change: false
    }

    expect(
      projectBillingStatus({ ...DECODED, next_charge: charge })?.next_charge
    ).toStrictEqual({ ...charge, amount: 2000 })
  })

  it('keeps a served absence of a next charge', () => {
    expect(
      projectBillingStatus({ ...DECODED, next_charge: null })?.next_charge
    ).toBeNull()
  })

  it('drops only a next charge whose amount a number cannot hold exactly', () => {
    const projected = projectBillingStatus({
      ...DECODED,
      next_charge: {
        amount: TOO_LARGE,
        currency: 'usd',
        date: '2026-11-27T12:00:00Z',
        reflects_scheduled_change: false
      }
    })

    expect(projected).toBeDefined()
    expect(projected).not.toHaveProperty('next_charge')
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
