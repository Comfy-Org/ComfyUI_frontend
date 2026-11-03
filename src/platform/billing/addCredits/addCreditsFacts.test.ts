import { describe, expect, it } from 'vitest'

import {
  ADD_CREDITS_COPY,
  addCreditsRefusalFor
} from '@comfyorg/account-core/billing'

import enMessages from '@/locales/en/main.json'
import {
  addCreditsPendingTopup,
  topupCheckoutFailure
} from '@/platform/billing/addCredits/addCreditsFacts'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

const VERIFY_URL = 'https://hooks.stripe.com/3ds/op-1'

describe('addCreditsPendingTopup', () => {
  it.for([
    {
      name: 'a bank check waiting on the customer',
      operation: {
        status: 'pending',
        actionUrl: VERIFY_URL,
        authenticationState: 'requires_action'
      },
      processing: null,
      expected: { kind: 'needs_verification', verifyUrl: VERIFY_URL }
    },
    {
      name: 'a legacy-rail operation with a verification link and no authentication state',
      operation: {
        status: 'pending',
        actionUrl: VERIFY_URL,
        authenticationState: null
      },
      processing: { paymentAmountCents: 2500 },
      expected: { kind: 'needs_verification', verifyUrl: VERIFY_URL }
    },
    {
      name: 'a failed bank check that still carries its link',
      operation: {
        status: 'pending',
        actionUrl: VERIFY_URL,
        authenticationState: 'failed_retryable'
      },
      processing: null,
      expected: { kind: 'not_verified' }
    },
    {
      name: 'a bank check that failed',
      operation: {
        status: 'pending',
        actionUrl: null,
        authenticationState: 'failed_retryable'
      },
      processing: null,
      expected: { kind: 'not_verified' }
    },
    {
      name: 'an operation awaiting reconciliation',
      operation: {
        status: 'reconciliation_needed',
        actionUrl: null,
        authenticationState: null
      },
      processing: { paymentAmountCents: 2500 },
      expected: { kind: 'not_verified' }
    },
    {
      name: 'a checkout still processing',
      operation: null,
      processing: { paymentAmountCents: 2500 },
      expected: { kind: 'processing', amountCents: 2500 }
    },
    {
      name: 'a checkout processing with no served amount',
      operation: null,
      processing: { paymentAmountCents: null },
      expected: { kind: 'processing' }
    },
    {
      name: 'nothing open',
      operation: null,
      processing: null,
      expected: undefined
    }
  ] as const)('reads $name', ({ operation, processing, expected }) => {
    expect(addCreditsPendingTopup(operation, processing)).toStrictEqual(
      expected
    )
  })
})

describe('topupCheckoutFailure', () => {
  it.for([
    {
      name: 'a 429 with its Retry-After',
      error: new WorkspaceApiError(
        'limit',
        429,
        'TOPUP_RATE_LIMITED',
        undefined,
        'createTopupCheckout',
        2400
      ),
      refusal: { kind: 'rate_limited', retryAfterSeconds: 2400 }
    },
    {
      name: 'a 429 without Retry-After',
      error: new WorkspaceApiError('limit', 429, 'TOPUP_RATE_LIMITED'),
      refusal: { kind: 'rate_limited' }
    },
    {
      name: 'a 403 for stopped purchases',
      error: new WorkspaceApiError('paused', 403, 'TOPUP_PURCHASES_PAUSED'),
      refusal: { kind: 'purchases_paused' }
    },
    {
      name: 'an uncoded 403',
      error: new WorkspaceApiError('denied', 403, 'FORBIDDEN'),
      refusal: { kind: 'not_allowed' }
    },
    {
      name: 'a network failure',
      error: new TypeError('Failed to fetch'),
      refusal: { kind: 'checkout_failed' }
    }
  ])('reads $name as its notice', ({ error, refusal }) => {
    expect(addCreditsRefusalFor(topupCheckoutFailure(error))).toStrictEqual(
      refusal
    )
  })
})

function flatten(node: unknown, prefix = ''): Record<string, unknown> {
  if (typeof node !== 'object' || node === null) return { [prefix]: node }
  return Object.fromEntries(
    Object.entries(node).flatMap(([key, value]) =>
      Object.entries(flatten(value, prefix ? `${prefix}.${key}` : key))
    )
  )
}

describe('Add credits copy', () => {
  it('keeps the en locale identical to the shared copy table', () => {
    expect(flatten(enMessages.addCreditsDialog)).toEqual(ADD_CREDITS_COPY)
  })
})
