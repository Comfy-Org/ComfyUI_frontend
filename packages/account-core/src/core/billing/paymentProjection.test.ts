import { describe, expect, it } from 'vitest'

import type {
  BillingOperationState,
  PendingBillingOperation
} from './operationState.js'
import type { HostPaymentStep, PaymentProjection } from './paymentProjection.js'
import { projectPaymentStep } from './paymentProjection.js'

const IDENTITY = {
  id: 'op-1',
  kind: 'subscription',
  scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
  presentation: 'embedded',
  observedAt: 0,
  attemptStartedAt: 0
} as const

function pending(
  overrides: Partial<
    Omit<PendingBillingOperation, 'presentation' | 'hostedDestination'>
  > = {}
): BillingOperationState {
  return {
    ...IDENTITY,
    phase: 'pending',
    customerActionSeen: false,
    ...overrides
  }
}

type FailedOperation = Extract<BillingOperationState, { phase: 'failed' }>

function failed(
  declineReason: FailedOperation['declineReason'],
  overrides: Partial<Pick<FailedOperation, 'recoveryAction' | 'retryable'>> = {}
): BillingOperationState {
  return {
    ...IDENTITY,
    phase: 'failed',
    declineReason,
    recoveryAction: 'replace_payment_method',
    retryable: true,
    ...overrides
  }
}

function terminal(
  phase: 'succeeded' | 'timed_out' | 'reconciliation_needed' | 'superseded'
): BillingOperationState {
  return { ...IDENTITY, phase }
}

interface Row {
  readonly name: string
  readonly operation: BillingOperationState | undefined
  readonly hostStep?: HostPaymentStep
  readonly expected: Partial<PaymentProjection>
}

const ROWS: readonly Row[] = [
  {
    name: 'no operation renders the host step: select',
    operation: undefined,
    hostStep: 'select',
    expected: { step: 'select' }
  },
  {
    name: 'no operation renders the host step: preview',
    operation: undefined,
    hostStep: 'preview',
    expected: { step: 'preview' }
  },
  {
    name: 'no operation with a host-reported cancel renders canceled',
    operation: undefined,
    hostStep: 'canceled',
    expected: { step: 'canceled', noChargeConfirmed: false }
  },
  {
    name: 'pending with nothing parked on the customer stays in preview',
    operation: pending(),
    expected: { step: 'preview', operationId: 'op-1' }
  },
  {
    name: 'pending on a hosted page is verifying',
    operation: pending({ actionUrl: 'https://checkout.example/pay' }),
    expected: { step: 'verifying' }
  },
  {
    name: 'pending on a required challenge is verifying',
    operation: pending({
      challenge: { clientSecret: 'pi_secret', status: 'required' }
    }),
    expected: { step: 'verifying' }
  },
  {
    name: 'pending after this tab completed the challenge stays verifying while processing',
    operation: pending({
      challenge: { clientSecret: 'pi_secret', status: 'completed' },
      authenticationState: 'processing'
    }),
    expected: { step: 'verifying' }
  },
  {
    name: 'pending after a failed challenge is declined for authentication',
    operation: pending({
      challenge: { clientSecret: 'pi_secret', status: 'failed' },
      authenticationState: 'failed_retryable'
    }),
    expected: { step: 'declined', reasonKey: 'authentication_failed' }
  },
  {
    name: 'pending with a retryable decline is declined with the coded reason',
    operation: pending({
      authenticationState: 'failed_retryable',
      declineReason: 'card_declined',
      recoveryAction: 'replace_payment_method'
    }),
    expected: {
      step: 'declined',
      reasonKey: 'card_declined',
      recoveryAction: 'replace_payment_method'
    }
  },
  {
    name: 'pending with a retryable processing fault is a processing error',
    operation: pending({
      authenticationState: 'failed_retryable',
      declineReason: 'processing_error'
    }),
    expected: { step: 'processing_error', reasonKey: 'processing_error' }
  },
  {
    name: 'a host-reported cancel outranks a pending operation',
    operation: pending({ actionUrl: 'https://checkout.example/pay' }),
    hostStep: 'canceled',
    expected: {
      step: 'canceled',
      noChargeConfirmed: false,
      operationId: 'op-1'
    }
  },
  {
    name: 'succeeded is success',
    operation: terminal('succeeded'),
    expected: { step: 'success', operationId: 'op-1' }
  },
  {
    name: 'a success outranks a host-reported cancel',
    operation: terminal('succeeded'),
    hostStep: 'canceled',
    expected: { step: 'success' }
  },
  {
    name: 'a card decline is declined with the coded reason',
    operation: failed('insufficient_funds'),
    expected: {
      step: 'declined',
      reasonKey: 'insufficient_funds',
      recoveryAction: 'replace_payment_method'
    }
  },
  {
    name: 'a generic failure is a processing error',
    operation: failed('generic'),
    expected: { step: 'processing_error', reasonKey: 'generic' }
  },
  {
    name: 'a non-retryable failure carries the server-sent contact_support',
    operation: failed('generic', {
      recoveryAction: 'contact_support',
      retryable: false
    }),
    expected: {
      step: 'processing_error',
      reasonKey: 'generic',
      recoveryAction: 'contact_support'
    }
  },
  {
    name: 'a non-retryable failure without a named recovery reads as contact_support',
    operation: failed('generic', {
      recoveryAction: undefined,
      retryable: false
    }),
    expected: { recoveryAction: 'contact_support' }
  },
  {
    name: 'a processing failure is a processing error',
    operation: failed('processing_error'),
    expected: { step: 'processing_error', reasonKey: 'processing_error' }
  },
  {
    name: 'a decline outranks a host-reported cancel',
    operation: failed('card_declined'),
    hostStep: 'canceled',
    expected: { step: 'declined' }
  },
  {
    name: 'timed_out is a generic processing error',
    operation: terminal('timed_out'),
    expected: { step: 'processing_error', reasonKey: 'generic' }
  },
  {
    name: 'a host-reported cancel outranks this tab giving up',
    operation: terminal('timed_out'),
    hostStep: 'canceled',
    expected: { step: 'canceled' }
  },
  {
    name: 'reconciliation_needed is a processing error carrying the operation id, not a hold',
    operation: terminal('reconciliation_needed'),
    expected: {
      step: 'processing_error',
      reasonKey: 'generic',
      operationId: 'op-1'
    }
  },
  {
    name: 'reconciliation_needed outranks a host-reported cancel',
    operation: terminal('reconciliation_needed'),
    hostStep: 'canceled',
    expected: { step: 'processing_error' }
  },
  {
    name: 'superseded returns to select',
    operation: terminal('superseded'),
    hostStep: 'preview',
    expected: { step: 'select' }
  },
  {
    name: 'a host-reported cancel outranks supersession',
    operation: terminal('superseded'),
    hostStep: 'canceled',
    expected: { step: 'canceled' }
  }
]

describe('projectPaymentStep', () => {
  it.for(ROWS)('$name', ({ operation, hostStep, expected }) => {
    const projection = projectPaymentStep(operation, hostStep ?? 'preview')

    expect(projection).toMatchObject(expected)
    expect(projection.operationId).toBe(operation?.id)
    expect(projection.noChargeConfirmed).toBe(false)
  })

  it('names no recovery for a retryable failure the server gave none', () => {
    expect(
      projectPaymentStep(
        failed('generic', { recoveryAction: undefined }),
        'preview'
      ).recoveryAction
    ).toBeUndefined()
  })

  it('never confirms that nothing was charged, whatever the operation reports', () => {
    const projections = ROWS.map(({ operation, hostStep }) =>
      projectPaymentStep(operation, hostStep ?? 'canceled')
    )

    expect(projections.some((p) => p.noChargeConfirmed)).toBe(false)
    expect(projections.map((p) => p.step)).not.toContain(
      'payment_received_hold'
    )
  })
})
