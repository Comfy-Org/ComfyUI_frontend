import type { SubscriptionCommandResult } from '@comfyorg/account-core/billing'
import { describe, expect, it } from 'vitest'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

import {
  failedOperation,
  serverCode,
  settledOperation
} from './billingSdkTestUtils'
import {
  projectPaymentPortalResult,
  projectSubscribeResult,
  projectSubscriptionResult
} from './subscriptionOperationView'

describe('projectSubscriptionResult', () => {
  it('reports a settled command as done', () => {
    const result: SubscriptionCommandResult = {
      status: 'ok',
      value: { phase: 'succeeded', operation: settledOperation('succeeded') }
    }

    expect(projectSubscriptionResult(result)).toEqual({
      status: 'ok',
      value: undefined
    })
  })

  it('reports a request the server refused as already satisfied', () => {
    expect(
      projectSubscriptionResult({ status: 'ok', value: { phase: 'succeeded' } })
    ).toEqual({ status: 'ok', value: undefined })
  })

  it.for([
    {
      phase: 'failed',
      operation: failedOperation(),
      detail:
        'Your bank declined this payment. Try another payment method or contact your bank.'
    },
    {
      phase: 'failed',
      operation: { ...failedOperation(), declineReason: 'insufficient_funds' },
      detail:
        'This payment method has insufficient funds. Try another payment method or contact your bank.'
    },
    {
      phase: 'timed_out',
      operation: settledOperation('timed_out'),
      detail: "We couldn't update your subscription. Please try again."
    },
    {
      phase: 'reconciliation_needed',
      operation: settledOperation('reconciliation_needed'),
      detail: "We couldn't update your subscription. Please try again."
    }
  ] as const)(
    'reports a $phase operation as a sentence for the customer',
    ({ phase, operation, detail }) => {
      const outcome = projectSubscriptionResult({
        status: 'ok',
        value: { phase, operation }
      })

      expect(outcome).toMatchObject({ status: 'error' })
      expect(
        outcome.status === 'error' ? outcome.error : undefined
      ).toMatchObject({ message: detail, code: phase })
    }
  )

  it('hands a missing route back so the caller keeps its legacy path', () => {
    expect(
      projectSubscriptionResult({
        status: 'error',
        code: 'NOT_FOUND',
        httpStatus: 404
      })
    ).toEqual({ status: 'unavailable' })
  })

  it.for([
    [
      { status: 'error', code: 'REQUEST_FAILED', httpStatus: 503 },
      {
        status: 503,
        code: 'REQUEST_FAILED',
        message: "We couldn't update your subscription. Please try again."
      }
    ],
    [
      {
        status: 'error',
        code: 'CONFLICT',
        httpStatus: 409,
        serverCode: serverCode('SUBSCRIPTION_LOCKED')
      },
      {
        status: 409,
        code: 'SUBSCRIPTION_LOCKED',
        message: "We couldn't update your subscription. Please try again."
      }
    ],
    [
      {
        status: 'error',
        code: 'REQUEST_FAILED',
        httpStatus: 400,
        serverCode: serverCode('SUBSCRIPTION_CHANGE_IN_PROGRESS'),
        serverMessage: 'a subscription change is already in progress'
      },
      {
        status: 400,
        code: 'SUBSCRIPTION_CHANGE_IN_PROGRESS',
        message: 'a subscription change is already in progress'
      }
    ],
    [
      { status: 'error', code: 'SUPERSEDED' },
      {
        status: undefined,
        code: 'SUPERSEDED',
        message: "We couldn't update your subscription. Please try again."
      }
    ],
    [
      { status: 'error', code: 'OPERATION_ALREADY_PENDING' },
      {
        status: undefined,
        code: 'OPERATION_ALREADY_PENDING',
        message:
          'A payment you started earlier is still going through. Finish it first, then choose a different plan.'
      }
    ]
  ] as const)('surfaces %o as a workspace error', ([failure, expected]) => {
    const outcome = projectSubscriptionResult(failure)

    expect(outcome.status).toBe('error')
    const error = outcome.status === 'error' ? outcome.error : undefined
    expect(error).toBeInstanceOf(WorkspaceApiError)
    expect(error).toMatchObject(expected)
  })
})

describe('projectSubscribeResult', () => {
  it.for([
    { issuedStatus: 'subscribed', requiredPayment: false },
    { issuedStatus: 'pending_payment', requiredPayment: true },
    { issuedStatus: 'needs_payment_method', requiredPayment: true },
    { issuedStatus: undefined, requiredPayment: true }
  ] as const)(
    'reports a subscribe issued as $issuedStatus as subscribed, requiredPayment $requiredPayment',
    ({ issuedStatus, requiredPayment }) => {
      expect(
        projectSubscribeResult({
          status: 'ok',
          value: {
            phase: 'succeeded',
            operation: settledOperation('succeeded', 'subscription'),
            ...(issuedStatus === undefined ? {} : { issuedStatus })
          }
        })
      ).toEqual({
        status: 'ok',
        value: {
          billing_op_id: 'op-1',
          status: 'subscribed',
          requiredPayment
        }
      })
    }
  )

  it.for([
    {
      phase: 'failed',
      operation: failedOperation('subscription'),
      detail:
        'Your bank declined this payment. Try another payment method or contact your bank.'
    },
    {
      phase: 'timed_out',
      operation: settledOperation('timed_out', 'subscription'),
      detail: "We couldn't update your subscription. Please try again."
    }
  ] as const)(
    'reports a $phase subscribe as a sentence for the customer',
    ({ phase, operation, detail }) => {
      const outcome = projectSubscribeResult({
        status: 'ok',
        value: { phase, operation }
      })

      expect(outcome).toMatchObject({ status: 'error' })
      expect(
        outcome.status === 'error' ? outcome.error : undefined
      ).toMatchObject({ message: detail, code: phase })
    }
  )
})

describe('projectPaymentPortalResult', () => {
  it('hands back the portal URL the host opens', () => {
    expect(
      projectPaymentPortalResult({
        status: 'ok',
        value: { url: 'https://portal.example/session' }
      })
    ).toEqual({ status: 'ok', value: 'https://portal.example/session' })
  })

  it('hands a missing route back so the caller keeps its legacy path', () => {
    expect(
      projectPaymentPortalResult({
        status: 'error',
        code: 'NOT_FOUND',
        httpStatus: 404
      })
    ).toEqual({ status: 'unavailable' })
  })

  it('surfaces a refusal as a workspace error', () => {
    const outcome = projectPaymentPortalResult({
      status: 'error',
      code: 'ACCESS_DENIED',
      httpStatus: 403
    })

    expect(outcome.status).toBe('error')
    expect(
      outcome.status === 'error' ? outcome.error : undefined
    ).toMatchObject({
      status: 403,
      code: 'ACCESS_DENIED',
      message: "We couldn't update your subscription. Please try again."
    })
  })
})
