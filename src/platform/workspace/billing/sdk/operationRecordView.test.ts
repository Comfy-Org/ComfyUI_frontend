import type { BillingOperationState } from '@comfyorg/account-core/billing'
import { describe, expect, it } from 'vitest'

import {
  failedTopup,
  pendingSubscription,
  pendingTopup,
  settledTopup
} from './billingSdkTestUtils'
import type { BillingOperationRecordView } from './operationRecordView'
import { projectOperationRecord } from './operationRecordView'

const challenge = (status: 'required' | 'in_progress') => ({
  clientSecret: 'cs-1',
  status
})

describe('projectOperationRecord', () => {
  it.for<[string, BillingOperationState, Partial<BillingOperationRecordView>]>([
    [
      'a bare pending operation claims nothing',
      pendingTopup(),
      {
        status: 'pending',
        actionUrl: null,
        phase: null,
        authenticationState: null,
        isAuthenticating: false,
        canRetryAuthentication: false
      }
    ],
    [
      'a hosted step is carried through',
      pendingTopup({ actionUrl: 'https://pay.example/1' }),
      { status: 'pending', actionUrl: 'https://pay.example/1' }
    ],
    [
      'the server phase is reported as the record phase',
      pendingTopup({ serverPhase: 'awaiting_payment_method' }),
      { status: 'pending', phase: 'awaiting_payment_method' }
    ],
    [
      'an authentication state is carried through',
      pendingTopup({ authenticationState: 'requires_action' }),
      { status: 'pending', authenticationState: 'requires_action' }
    ],
    [
      'a challenge in progress reads as authenticating',
      pendingTopup({ challenge: challenge('in_progress') }),
      { isAuthenticating: true, canRetryAuthentication: false }
    ],
    [
      'a challenge awaiting the customer offers a retry',
      pendingTopup({ challenge: challenge('required') }),
      { isAuthenticating: false, canRetryAuthentication: true }
    ],
    [
      'the kind is preserved so a lookup can tell operations apart',
      pendingSubscription(),
      { kind: 'subscription', status: 'pending' }
    ],
    [
      'a succeeded operation drops its pending detail',
      settledTopup('succeeded'),
      {
        status: 'succeeded',
        actionUrl: null,
        phase: null,
        authenticationState: null
      }
    ],
    [
      'timed_out is reported under the record name, timeout',
      settledTopup('timed_out'),
      { status: 'timeout' }
    ],
    [
      'reconciliation is its own authentication state, as the top-up view has it',
      settledTopup('reconciliation_needed'),
      {
        status: 'reconciliation_needed',
        authenticationState: 'reconciliation_needed'
      }
    ],
    ['a decline reads as failed', failedTopup(), { status: 'failed' }]
  ])('%s', ([, state, expected]) => {
    expect(projectOperationRecord(state)).toMatchObject({
      opId: state.id,
      workspaceId: state.scope.workspaceId,
      ...expected
    })
  })

  it('has no record for an operation the scope moved on from', () => {
    expect(projectOperationRecord(settledTopup('superseded'))).toBeUndefined()
  })
})
