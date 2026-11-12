import { describe, expect, it } from 'vitest'

import { readBillingErrorCode } from '#/core/billing/billingErrorBody'
import type { HostedTopupCheckoutFailure } from '#/core/billing/topup'
import {
  addCreditsRefusalFor,
  addCreditsRefusalForDenial,
  addCreditsWait
} from './addCreditsRefusal'

function serverFailure(
  httpStatus: number,
  code: string,
  extra: { retryAfterSeconds?: number } = {}
): HostedTopupCheckoutFailure {
  const serverCode = readBillingErrorCode({ code, message: code })
  return {
    status: 'error',
    code: httpStatus === 403 ? 'ACCESS_DENIED' : 'REQUEST_FAILED',
    httpStatus,
    ...(serverCode === undefined ? {} : { serverCode }),
    ...extra
  }
}

describe('addCreditsRefusalFor', () => {
  it.for<{
    name: string
    failure: HostedTopupCheckoutFailure
    expected: unknown
  }>([
    {
      name: '429 with Retry-After',
      failure: serverFailure(429, 'TOPUP_RATE_LIMITED', {
        retryAfterSeconds: 2400
      }),
      expected: { kind: 'rate_limited', retryAfterSeconds: 2400 }
    },
    {
      name: '429 without Retry-After',
      failure: serverFailure(429, 'TOPUP_RATE_LIMITED'),
      expected: { kind: 'rate_limited' }
    },
    {
      name: '403 purchases paused',
      failure: serverFailure(403, 'TOPUP_PURCHASES_PAUSED'),
      expected: { kind: 'purchases_paused' }
    },
    {
      name: 'capability refusal for paused purchases',
      failure: {
        status: 'error',
        code: 'ACCESS_DENIED',
        denial: 'topup_purchases_paused'
      },
      expected: { kind: 'purchases_paused' }
    },
    {
      name: 'capability refusal without a reason',
      failure: { status: 'error', code: 'ACCESS_DENIED' },
      expected: { kind: 'not_allowed' }
    },
    {
      name: 'unknown server code',
      failure: serverFailure(400, 'SOMETHING_NEW'),
      expected: { kind: 'checkout_failed' }
    },
    {
      name: 'network failure',
      failure: { status: 'error', code: 'REQUEST_FAILED' },
      expected: { kind: 'checkout_failed' }
    },
    {
      name: 'route not deployed',
      failure: { status: 'error', code: 'NOT_AVAILABLE' },
      expected: { kind: 'checkout_failed' }
    }
  ])('maps $name', ({ failure, expected }) => {
    expect(addCreditsRefusalFor(failure)).toStrictEqual(expected)
  })
})

describe('addCreditsRefusalForDenial', () => {
  it.for([
    { denial: 'topup_purchases_paused', kind: 'purchases_paused' },
    { denial: 'payment_past_due', kind: 'not_allowed' },
    { denial: undefined, kind: 'not_allowed' }
  ] as const)('maps $denial to $kind', ({ denial, kind }) => {
    expect(addCreditsRefusalForDenial(denial)).toStrictEqual({ kind })
  })
})

describe('addCreditsWait', () => {
  it.for([
    { seconds: undefined, expected: { unit: 'later' } },
    { seconds: 0, expected: { unit: 'later' } },
    { seconds: 30, expected: { unit: 'minute', count: 1 } },
    { seconds: 2400, expected: { unit: 'minute', count: 40 } },
    { seconds: 2401, expected: { unit: 'minute', count: 41 } },
    { seconds: 3600, expected: { unit: 'hour', count: 1 } },
    { seconds: 5400, expected: { unit: 'hour', count: 2 } },
    { seconds: 86_400, expected: { unit: 'day', count: 1 } },
    { seconds: 200_000, expected: { unit: 'day', count: 3 } }
  ])('reads $seconds seconds as $expected', ({ seconds, expected }) => {
    expect(addCreditsWait(seconds)).toStrictEqual(expected)
  })
})
