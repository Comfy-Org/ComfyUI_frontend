import { describe, expect, it } from 'vitest'

import type {
  SubscriptionCommandResult,
  TerminalBillingOperation
} from '@comfyorg/account-core/billing'

import type { AttemptOutcome } from '@/telemetry/attemptTelemetry'
import { outcomeOfCommandResult } from '@/telemetry/attemptTelemetry'
import {
  failedOperation,
  succeededOperation,
  unresolvedOperation
} from '@/test/fakeBillingClient'

function settled(
  operation: TerminalBillingOperation
): SubscriptionCommandResult {
  return { status: 'ok', value: { phase: operation.phase, operation } }
}

const ALREADY_HELD: SubscriptionCommandResult = {
  status: 'ok',
  value: { phase: 'succeeded' }
}

describe('outcomeOfCommandResult', () => {
  it.for<{
    name: string
    result: SubscriptionCommandResult
    outcome: AttemptOutcome
  }>([
    {
      name: 'a payment the server settled',
      result: settled(succeededOperation('op_1')),
      outcome: { kind: 'succeeded', billingOpId: 'op_1' }
    },
    {
      name: 'a requested state that already held, which issued nothing',
      result: ALREADY_HELD,
      outcome: { kind: 'succeeded' }
    },
    {
      name: 'a decline, with the bank reason',
      result: settled(failedOperation('card_declined', 'op_2')),
      outcome: {
        kind: 'failed',
        failure: { failure_category: 'provider_decline' },
        billingOpId: 'op_2',
        declineReason: 'card_declined'
      }
    },
    {
      name: 'a poll budget that ran out',
      result: settled(unresolvedOperation('timed_out', 'op_3')),
      outcome: {
        kind: 'failed',
        failure: { failure_category: 'poll_timeout' },
        billingOpId: 'op_3'
      }
    },
    {
      name: 'an operation the server parked for a human',
      result: settled(unresolvedOperation('reconciliation_needed', 'op_4')),
      outcome: {
        kind: 'failed',
        failure: { failure_category: 'reconciliation_needed' },
        billingOpId: 'op_4'
      }
    },
    {
      name: 'an operation another one replaced',
      result: settled(unresolvedOperation('superseded', 'op_5')),
      outcome: {
        kind: 'failed',
        failure: { failure_category: 'stale_operation' },
        billingOpId: 'op_5'
      }
    },
    {
      name: 'a request the contract refuses before anything is sent',
      result: { status: 'error', code: 'INVALID_REQUEST' },
      outcome: {
        kind: 'failed',
        failure: {
          failure_category: 'validation',
          error_code: 'invalid_request'
        }
      }
    },
    {
      name: 'a card and a saved method sent together',
      result: { status: 'error', code: 'CONFLICTING_PAYMENT_METHOD' },
      outcome: {
        kind: 'failed',
        failure: {
          failure_category: 'validation',
          error_code: 'conflicting_payment_method'
        }
      }
    },
    {
      name: 'a quote the server no longer honours',
      result: { status: 'error', code: 'QUOTE_STALE' },
      outcome: {
        kind: 'failed',
        failure: {
          failure_category: 'api_rejected',
          error_code: 'quote_stale'
        }
      }
    },
    {
      name: 'an operation already pending',
      result: {
        status: 'error',
        code: 'OPERATION_ALREADY_PENDING',
        httpStatus: 409
      },
      outcome: {
        kind: 'failed',
        failure: {
          failure_category: 'api_rejected',
          error_code: 'operation_already_pending'
        }
      }
    },
    {
      name: 'a payment step the server offered no page for',
      result: { status: 'error', code: 'MISSING_PAYMENT_METHOD_URL' },
      outcome: {
        kind: 'failed',
        failure: {
          failure_category: 'redirect',
          error_code: 'missing_payment_method_url'
        }
      }
    },
    {
      name: 'an answer that does not match the contract',
      result: { status: 'error', code: 'MALFORMED_RESPONSE', httpStatus: 200 },
      outcome: {
        kind: 'failed',
        failure: {
          failure_category: 'unknown',
          error_code: 'missing_checkout_response'
        }
      }
    },
    {
      name: 'a request that never reached the server',
      result: { status: 'error', code: 'REQUEST_FAILED' },
      outcome: { kind: 'failed', failure: { failure_category: 'network' } }
    },
    {
      name: 'a sign-in that could not produce a token',
      result: { status: 'error', code: 'NOT_AUTHENTICATED' },
      outcome: { kind: 'failed', failure: { failure_category: 'network' } }
    },
    {
      name: 'a server error',
      result: { status: 'error', code: 'REQUEST_FAILED', httpStatus: 503 },
      outcome: {
        kind: 'failed',
        failure: { failure_category: 'api_rejected' }
      }
    },
    {
      name: 'a refusal that carries the server own words, which are never forwarded',
      result: {
        status: 'error',
        code: 'CONFLICT',
        httpStatus: 409,
        serverMessage: 'Stripe: card_declined (do_not_honor) for cus_123'
      },
      outcome: {
        kind: 'failed',
        failure: { failure_category: 'api_rejected' }
      }
    },
    {
      name: 'an identity or workspace that changed mid-request',
      result: { status: 'error', code: 'SUPERSEDED' },
      outcome: {
        kind: 'failed',
        failure: { failure_category: 'stale_operation' }
      }
    },
    {
      name: 'a demand for the reactivation consent, which is the attempt carrying on',
      result: { status: 'error', code: 'REACTIVATION_CONFIRMATION_REQUIRED' },
      outcome: { kind: 'continued' }
    }
  ])('reads $name', ({ result, outcome }) => {
    expect(outcomeOfCommandResult(result)).toEqual(outcome)
  })
})
