import type {
  BillingDeclineReason,
  BillingOperationState,
  FailedBillingOperation,
  SubscriptionCommandResult,
  TerminalBillingOperation,
  TopupResult
} from '@comfyorg/account-core/billing'
import { readBillingErrorCode } from '@comfyorg/account-core/billing'

import type { OperationOutcome } from '@/checkout/checkoutPage'
import type { PayVerdict } from '@/checkout/payVerdict'
import {
  operationOutcomeOf,
  payVerdictOf,
  supportLinkFor,
  supportLinkWithCode,
  topupVerdictOf
} from '@/checkout/payVerdict'
import {
  failedOperation,
  pendingOperation,
  succeededOperation
} from '@/test/fakeBillingClient'

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
      name: 'a challenge the customer did not complete',
      result: settledAs(failedOperation('authentication_failed', 'op_3')),
      expected: {
        kind: 'outcome',
        outcome: { kind: 'not_completed', operationId: 'op_3' }
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
      name: 'an operation parked for a human, an unknown outcome and never a card',
      result: settledAs({
        ...succeededOperation('op_5'),
        phase: 'reconciliation_needed'
      }),
      expected: reconciling
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
      result: { status: 'error', code: 'QUOTE_STALE' },
      expected: { kind: 'requote', because: 'quote_expired' }
    },
    {
      name: 'a reactivation the server wants confirmed',
      result: { status: 'error', code: 'REACTIVATION_CONFIRMATION_REQUIRED' },
      expected: { kind: 'requote', because: 'reactivation_required' }
    },
    {
      name: 'a stale quote as account-core normalizes it',
      result: { status: 'error', code: 'QUOTE_STALE' },
      expected: { kind: 'requote', because: 'quote_expired' }
    },
    {
      name: 'an unreachable billing service is the processing error card, coded for support',
      result: { status: 'error', code: 'REQUEST_FAILED' },
      expected: {
        kind: 'outcome',
        outcome: { kind: 'processing_error', code: 'REQUEST_FAILED' }
      }
    },
    {
      name: 'a server error keeps the sentence the server wrote',
      result: {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 500,
        serverMessage: 'Billing is down for maintenance.'
      },
      expected: {
        kind: 'outcome',
        outcome: {
          kind: 'processing_error',
          code: 'REQUEST_FAILED',
          serverMessage: 'Billing is down for maintenance.'
        }
      }
    }
  ])('$name', ({ result, expected }) => {
    expect(payVerdictOf(result)).toEqual(expected)
  })
})

/** A failure as the server reports it, with the remedy it names. */
function failedWith(
  declineReason: BillingDeclineReason,
  remedy: Pick<FailedBillingOperation, 'recoveryAction'> &
    Partial<Pick<FailedBillingOperation, 'retryable'>>
): FailedBillingOperation {
  return {
    ...failedOperation(declineReason, 'op_x'),
    phase: 'failed',
    declineReason,
    retryable: true,
    ...remedy
  }
}

describe('operationOutcomeOf', () => {
  it.for<{
    name: string
    operation: BillingOperationState
    outcome: OperationOutcome | undefined
  }>([
    {
      name: 'a decline keeps its reason',
      operation: failedOperation('expired_card', 'op_x'),
      outcome: { kind: 'declined', reason: 'expired_card', operationId: 'op_x' }
    },
    {
      name: 'a challenge the customer did not complete',
      operation: failedOperation('authentication_failed', 'op_x'),
      outcome: { kind: 'not_completed', operationId: 'op_x' }
    },
    {
      name: 'a bank that asked for authentication nobody gave',
      operation: failedOperation('authentication_required', 'op_x'),
      outcome: { kind: 'not_completed', operationId: 'op_x' }
    },
    {
      name: 'a payment the customer did not approve or let expire',
      operation: failedWith('payment_not_completed', {
        recoveryAction: 'retry'
      }),
      outcome: { kind: 'not_completed', operationId: 'op_x' }
    },
    {
      name: 'a pending payment the customer did not approve',
      operation: {
        ...pendingOperation('op_x'),
        authenticationState: 'failed_retryable',
        declineReason: 'payment_not_completed'
      },
      outcome: { kind: 'not_completed', operationId: 'op_x' }
    },
    {
      name: 'an Alipay payment the customer backed out of, still pending',
      operation: {
        ...pendingOperation('op_x'),
        authenticationState: 'failed_retryable',
        declineReason: 'authentication_failed'
      },
      outcome: { kind: 'not_completed', operationId: 'op_x' }
    },
    {
      name: 'a pending payment the bank refused for missing authentication',
      operation: {
        ...pendingOperation('op_x'),
        authenticationState: 'failed_retryable',
        declineReason: 'authentication_required'
      },
      outcome: { kind: 'not_completed', operationId: 'op_x' }
    },
    {
      name: 'an attempt the server ended unpaid and marks a plain retry',
      operation: failedWith('generic', { recoveryAction: 'retry' }),
      outcome: { kind: 'not_completed', operationId: 'op_x' }
    },
    {
      name: 'a failure the server gives no reason or remedy for',
      operation: failedWith('generic', { retryable: false }),
      outcome: { kind: 'processing_error', operationId: 'op_x' }
    },
    {
      name: 'a card decline the server marks for a new card',
      operation: failedWith('card_declined', {
        recoveryAction: 'replace_payment_method'
      }),
      outcome: {
        kind: 'declined',
        reason: 'card_declined',
        operationId: 'op_x'
      }
    },
    {
      name: 'a processing fault',
      operation: failedOperation('processing_error', 'op_x'),
      outcome: { kind: 'processing_error', operationId: 'op_x' }
    },
    {
      name: 'a processing fault the server marks for a plain retry',
      operation: failedWith('processing_error', { recoveryAction: 'retry' }),
      outcome: { kind: 'processing_error', operationId: 'op_x' }
    },
    {
      name: 'a parked attempt whose last try declined',
      operation: {
        ...pendingOperation('op_x'),
        serverPhase: 'awaiting_payment_method',
        declineReason: 'card_declined'
      },
      outcome: {
        kind: 'declined',
        reason: 'card_declined',
        operationId: 'op_x'
      }
    },
    {
      name: 'a charge in flight has no verdict yet',
      operation: pendingOperation('op_x'),
      outcome: undefined
    },
    {
      name: 'a success is not a card',
      operation: succeededOperation('op_x'),
      outcome: undefined
    },
    {
      name: 'a poll budget that ran out is unknown, never a card (rule 12)',
      operation: { ...succeededOperation('op_x'), phase: 'timed_out' },
      outcome: undefined
    },
    {
      name: 'a superseded operation says nothing',
      operation: { ...succeededOperation('op_x'), phase: 'superseded' },
      outcome: undefined
    },
    {
      name: 'an operation parked for a human is unknown, never a card',
      operation: {
        ...succeededOperation('op_x'),
        phase: 'reconciliation_needed'
      },
      outcome: undefined
    }
  ])('$name', ({ operation, outcome }) => {
    expect(operationOutcomeOf(operation)).toEqual(outcome)
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

  it('quotes the code of a refused Pay', () => {
    const link = new URL(
      supportLinkFor({ kind: 'processing_error', code: 'REQUEST_FAILED' })
    )

    expect(link.searchParams.get('body')).toBe('Error code: REQUEST_FAILED')
  })

  it('leaves the body out when there is nothing to name', () => {
    const link = new URL(supportLinkFor({ kind: 'processing_error' }))

    expect(link.searchParams.has('body')).toBe(false)
  })
})

describe('supportLinkWithCode', () => {
  it.for<{ code: string | undefined; body: string | null }>([
    { code: 'PLAN_NOT_FOUND', body: 'Reference: PLAN_NOT_FOUND' },
    { code: undefined, body: null }
  ])('quotes $code', ({ code, body }) => {
    const link = new URL(supportLinkWithCode(code))

    expect(link.pathname).toBe('support@comfy.org')
    expect(link.searchParams.get('body')).toBe(body)
  })
})

describe('topupVerdictOf', () => {
  const succeeded = {
    ...succeededOperation('op_topup'),
    phase: 'succeeded'
  } as const

  it.for<{ name: string; result: TopupResult; verdict: PayVerdict }>([
    {
      name: 'a top-up that went through',
      result: { status: 'ok', operation: succeeded, creditsReconciled: true },
      verdict: { kind: 'settled' }
    },
    {
      name: 'a decline, with the reason the operation carries',
      result: {
        status: 'declined',
        operation: {
          ...failedOperation('insufficient_funds', 'op_topup'),
          phase: 'failed',
          declineReason: 'insufficient_funds',
          retryable: true
        }
      },
      verdict: {
        kind: 'outcome',
        outcome: {
          kind: 'declined',
          operationId: 'op_topup',
          reason: 'insufficient_funds'
        }
      }
    },
    {
      name: 'an operation the lifecycle stopped watching',
      result: {
        status: 'unsettled',
        operation: { ...succeeded, phase: 'timed_out' }
      },
      verdict: { kind: 'outcome', outcome: { kind: 'reconciling' } }
    },
    {
      name: 'no saved payment method to charge',
      result: {
        status: 'error',
        code: 'NO_PAYMENT_METHOD',
        recoveryAction: 'replace_payment_method'
      },
      verdict: {
        kind: 'outcome',
        outcome: { kind: 'processing_error', code: 'NO_PAYMENT_METHOD' }
      }
    },
    {
      name: 'a refusal the server explained',
      result: {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 400,
        serverMessage: 'Top-ups are paused'
      },
      verdict: {
        kind: 'outcome',
        outcome: {
          kind: 'processing_error',
          code: 'REQUEST_FAILED',
          serverMessage: 'Top-ups are paused'
        }
      }
    }
  ])('$name', ({ result, verdict }) => {
    expect(topupVerdictOf(result)).toEqual(verdict)
  })
})
