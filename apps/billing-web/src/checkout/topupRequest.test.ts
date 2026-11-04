import type { TopupResult } from '@comfyorg/account-core/billing'

import { settlesAttempt } from '@/checkout/topupRequest'
import {
  failedOperation,
  succeededOperation,
  unresolvedOperation
} from '@/test/fakeBillingClient'

describe('settlesAttempt', () => {
  it.for<{ name: string; result: TopupResult; settles: boolean }>([
    {
      name: 'a success',
      result: {
        status: 'ok',
        operation: {
          ...succeededOperation('op_topup'),
          phase: 'succeeded',
          kind: 'topup'
        },
        creditsReconciled: true
      },
      settles: true
    },
    {
      name: 'a decline',
      result: {
        status: 'declined',
        operation: {
          ...failedOperation('card_declined', 'op_topup'),
          phase: 'failed',
          declineReason: 'card_declined',
          retryable: true
        }
      },
      settles: true
    },
    {
      name: 'an operation the poll stopped watching',
      result: {
        status: 'unsettled',
        operation: {
          ...unresolvedOperation('timed_out', 'op_topup'),
          phase: 'timed_out'
        }
      },
      settles: false
    },
    {
      name: 'a coded 400 refusal',
      result: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 400 },
      settles: true
    },
    {
      name: 'a route this backend lacks',
      result: { status: 'error', code: 'NOT_AVAILABLE' },
      settles: true
    },
    {
      name: 'a 409 for a purchase still under way',
      result: { status: 'error', code: 'CONFLICT', httpStatus: 409 },
      settles: false
    },
    {
      name: 'a rate limit',
      result: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 429 },
      settles: false
    },
    {
      name: 'a 503 with the payment state unknown',
      result: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 503 },
      settles: false
    },
    {
      name: 'a request that got no answer',
      result: { status: 'error', code: 'REQUEST_FAILED' },
      settles: false
    },
    {
      name: 'a workspace switch mid-request',
      result: { status: 'error', code: 'SUPERSEDED' },
      settles: false
    }
  ])('$name settles the purchase: $settles', ({ result, settles }) => {
    expect(settlesAttempt(result)).toBe(settles)
  })
})
