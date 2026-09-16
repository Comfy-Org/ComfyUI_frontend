import { describe, expect, it } from 'vitest'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'

import { failedTopup, pendingTopup, settledTopup } from './billingSdkTestUtils'
import { projectTopupOperation, projectTopupResult } from './topupOperationView'

describe('projectTopupOperation', () => {
  it('hands the dialog the hosted verification link', () => {
    const view = projectTopupOperation(
      pendingTopup({ actionUrl: 'https://verify.example/op-1' })
    )

    expect(view).toMatchObject({
      opId: 'op-1',
      status: 'pending',
      actionUrl: 'https://verify.example/op-1',
      errorMessage: null
    })
  })

  it.for([
    ['required', { canRetryAuthentication: true, isAuthenticating: false }],
    ['in_progress', { canRetryAuthentication: false, isAuthenticating: true }]
  ] as const)('reflects a %s in-page challenge', ([status, expected]) => {
    expect(
      projectTopupOperation(
        pendingTopup({
          presentation: 'embedded',
          authenticationState: 'requires_action',
          challenge: { clientSecret: 'pi_secret', status }
        })
      )
    ).toMatchObject(expected)
  })

  it('explains a declined retry with the coded reason, never server text', () => {
    const view = projectTopupOperation(
      pendingTopup({
        authenticationState: 'failed_retryable',
        declineReason: 'insufficient_funds'
      })
    )

    expect(view?.errorMessage).toBe(
      'This payment method has insufficient funds. Try another payment method or contact your bank.'
    )
  })

  it('surfaces an operation support must reconcile by its id', () => {
    const view = projectTopupOperation(settledTopup('reconciliation_needed'))

    expect(view).toMatchObject({
      opId: 'op-1',
      status: 'reconciliation_needed'
    })
  })

  it.for(['succeeded', 'timed_out', 'superseded'] as const)(
    'drops a %s operation from the dialog',
    (phase) => {
      expect(projectTopupOperation(settledTopup(phase))).toBeUndefined()
    }
  )
})

describe('projectTopupResult', () => {
  it('reports a settled purchase as the completed response', () => {
    expect(
      projectTopupResult(
        {
          status: 'ok',
          operation: settledTopup('succeeded'),
          creditsReconciled: true
        },
        1000
      )
    ).toEqual({
      billing_op_id: 'op-1',
      topup_id: '',
      status: 'completed',
      amount_cents: 1000
    })
  })

  it('reports a decline as the failed response', () => {
    expect(
      projectTopupResult({ status: 'declined', operation: failedTopup() }, 1000)
    ).toMatchObject({ billing_op_id: 'op-1', status: 'failed' })
  })

  it('reports nothing for a purchase this tab stopped observing', () => {
    expect(
      projectTopupResult(
        { status: 'unsettled', operation: settledTopup('timed_out') },
        1000
      )
    ).toBeUndefined()
  })

  it('throws the API error whose code the dialog already handles', () => {
    expect(() =>
      projectTopupResult(
        {
          status: 'error',
          code: 'NO_PAYMENT_METHOD',
          recoveryAction: 'replace_payment_method'
        },
        1000
      )
    ).toThrow(
      expect.objectContaining({
        name: 'WorkspaceApiError',
        code: 'NO_PAYMENT_METHOD'
      })
    )
  })

  it('carries the HTTP status of a transport failure', () => {
    let thrown: unknown
    try {
      projectTopupResult(
        { status: 'error', code: 'REQUEST_FAILED', httpStatus: 503 },
        1000
      )
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(WorkspaceApiError)
    expect(thrown).toMatchObject({ status: 503, code: 'REQUEST_FAILED' })
  })
})
