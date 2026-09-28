import type {
  SubscriptionCommandResult,
  TerminalBillingOperation
} from '@comfyorg/account-core/billing'
import { readBillingErrorCode } from '@comfyorg/account-core/billing'

import type { PayVerdict } from '@/checkout/payVerdict'
import { payVerdictOf, supportLinkFor } from '@/checkout/payVerdict'
import { failedOperation, succeededOperation } from '@/test/fakeBillingClient'

function settledAs(
  operation?: TerminalBillingOperation
): SubscriptionCommandResult {
  return {
    status: 'ok',
    value: {
      phase: operation?.phase ?? 'succeeded',
      ...(operation === undefined ? {} : { operation })
    }
  }
}

function refusedWith(
  code: 'CONFLICT' | 'REQUEST_FAILED',
  serverCode: string
): SubscriptionCommandResult {
  return {
    status: 'error',
    code,
    httpStatus: 409,
    serverCode: readBillingErrorCode({ code: serverCode, message: 'refused' })
  }
}

const reconciling: PayVerdict = {
  kind: 'outcome',
  outcome: { kind: 'reconciling' }
}

describe('payVerdictOf', () => {
  it.for<{
    name: string
    result: SubscriptionCommandResult
    expected: PayVerdict
  }>([
    {
      name: 'a charge that went through',
      result: settledAs(succeededOperation('op_1')),
      expected: { kind: 'settled' }
    },
    {
      name: 'a plan already held, nothing issued',
      result: settledAs(),
      expected: { kind: 'settled' }
    },
    {
      name: 'a card decline, with its reason and operation',
      result: settledAs(failedOperation('insufficient_funds', 'op_2')),
      expected: {
        kind: 'outcome',
        outcome: {
          kind: 'declined',
          reason: 'insufficient_funds',
          operationId: 'op_2'
        }
      }
    },
    {
      name: 'a failed bank verification',
      result: settledAs(failedOperation('authentication_failed', 'op_3')),
      expected: {
        kind: 'outcome',
        outcome: { kind: 'verification_failed', operationId: 'op_3' }
      }
    },
    {
      name: 'a processing fault',
      result: settledAs(failedOperation('processing_error', 'op_4')),
      expected: {
        kind: 'outcome',
        outcome: { kind: 'processing_error', operationId: 'op_4' }
      }
    },
    {
      name: 'an operation that needs a human',
      result: settledAs({
        ...succeededOperation('op_5'),
        phase: 'reconciliation_needed'
      }),
      expected: {
        kind: 'outcome',
        outcome: { kind: 'processing_error', operationId: 'op_5' }
      }
    },
    {
      name: 'a poll budget that ran out, an unknown outcome',
      result: settledAs({ ...succeededOperation('op_6'), phase: 'timed_out' }),
      expected: reconciling
    },
    {
      name: 'an operation already pending',
      result: { status: 'error', code: 'OPERATION_ALREADY_PENDING' },
      expected: reconciling
    },
    {
      name: 'a server conflict',
      result: { status: 'error', code: 'CONFLICT', httpStatus: 409 },
      expected: reconciling
    },
    {
      name: 'an expired proration quote',
      result: refusedWith('CONFLICT', 'PRORATION_QUOTE_EXPIRED'),
      expected: { kind: 'requote', because: 'quote_expired' }
    },
    {
      name: 'a stale subscription quote',
      result: refusedWith('REQUEST_FAILED', 'SUBSCRIPTION_QUOTE_STALE'),
      expected: { kind: 'requote', because: 'quote_expired' }
    },
    {
      name: 'a reactivation the server wants confirmed',
      result: { status: 'error', code: 'REACTIVATION_CONFIRMATION_REQUIRED' },
      expected: { kind: 'requote', because: 'reactivation_required' }
    },
    {
      name: 'an unreachable billing service',
      result: { status: 'error', code: 'REQUEST_FAILED' },
      expected: { kind: 'failure', code: 'REQUEST_FAILED' }
    }
  ])('$name', ({ result, expected }) => {
    expect(payVerdictOf(result)).toEqual(expected)
  })
})

describe('supportLinkFor', () => {
  it('names the operation and the decline code', () => {
    const link = new URL(
      supportLinkFor({
        kind: 'declined',
        reason: 'card_declined',
        operationId: 'op_9'
      })
    )

    expect(link.protocol).toBe('mailto:')
    expect(link.pathname).toBe('support@comfy.org')
    expect(link.searchParams.get('body')).toBe(
      'Operation: op_9\nDecline code: card_declined'
    )
  })

  it('leaves the body out when there is nothing to name', () => {
    const link = new URL(supportLinkFor({ kind: 'processing_error' }))

    expect(link.searchParams.has('body')).toBe(false)
  })
})
