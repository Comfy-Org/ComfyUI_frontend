import { describe, expect, it } from 'vitest'

import type {
  BillingOpStatus,
  BillingOperationIdentity,
  BillingOperationState,
  BillingPresentationState,
  PendingBillingOperation
} from './operationState.js'
import { reduceBillingOperation, validateActionUrl } from './operationState.js'

const SCOPE = { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' } as const

function pending(
  overrides: Partial<
    Omit<PendingBillingOperation, 'presentation' | 'hostedDestination'>
  > = {},
  presentation: BillingPresentationState = { presentation: 'embedded' }
): PendingBillingOperation {
  return {
    id: 'op-1',
    kind: 'subscription',
    scope: SCOPE,
    ...presentation,
    observedAt: 1_000,
    attemptStartedAt: 500,
    phase: 'pending',
    customerActionSeen: false,
    ...overrides
  }
}

function status(overrides: Partial<BillingOpStatus> = {}): BillingOpStatus {
  return {
    id: 'op-1',
    status: 'pending',
    started_at: '2026-09-14T00:00:00.000Z',
    ...overrides
  }
}

function polled(
  state: BillingOperationState,
  overrides: Partial<BillingOpStatus>
) {
  return reduceBillingOperation(state, {
    type: 'status_polled',
    status: status(overrides)
  })
}

describe('reduceBillingOperation', () => {
  it('terminalizes on the server verdict and keeps the coded reason only', () => {
    const failed = polled(pending(), {
      status: 'failed',
      decline_reason: 'insufficient_funds',
      recovery_action: 'replace_payment_method',
      retryable: true,
      error_message: 'Your card has insufficient funds. (Stripe: card_error)'
    })

    expect(failed).toMatchObject({
      phase: 'failed',
      id: 'op-1',
      declineReason: 'insufficient_funds',
      recoveryAction: 'replace_payment_method',
      retryable: true
    })
    expect(JSON.stringify(failed)).not.toContain('Stripe')
    expect(polled(pending(), { status: 'failed' })).toMatchObject({
      phase: 'failed',
      declineReason: 'generic',
      retryable: false
    })
    expect(polled(pending(), { status: 'succeeded' }).phase).toBe('succeeded')
  })

  it('ignores a status that names another operation', () => {
    const state = pending()

    expect(polled(state, { id: 'op-2', status: 'succeeded' })).toBe(state)
    expect(polled(state, { id: 'op-2', status: 'failed' })).toBe(state)
  })

  it('treats a reconciliation authentication state as terminal like the status', () => {
    expect(
      polled(pending(), { authentication_state: 'reconciliation_needed' }).phase
    ).toBe('reconciliation_needed')
    expect(polled(pending(), { status: 'reconciliation_needed' }).phase).toBe(
      'reconciliation_needed'
    )
  })

  it('ignores every event once terminal', () => {
    const succeeded = polled(pending(), { status: 'succeeded' })

    expect(polled(succeeded, { status: 'failed' })).toBe(succeeded)
    expect(reduceBillingOperation(succeeded, { type: 'superseded' })).toBe(
      succeeded
    )
    expect(
      reduceBillingOperation(succeeded, {
        type: 'presentation_switched',
        presentation: 'hosted',
        hostedDestination: 'stripe'
      })
    ).toBe(succeeded)
  })

  it('adopts a challenge for the embedded presentation only', () => {
    const embedded = polled(pending(), {
      authentication_state: 'requires_action',
      payment_intent_client_secret: 'pi_secret'
    })
    const hosted = polled(
      pending({}, { presentation: 'hosted', hostedDestination: 'stripe' }),
      {
        authentication_state: 'requires_action',
        payment_intent_client_secret: 'pi_secret'
      }
    )

    expect(embedded).toMatchObject({
      challenge: { clientSecret: 'pi_secret', status: 'required' },
      customerActionSeen: true
    })
    expect(hosted).toMatchObject({ phase: 'pending', customerActionSeen: true })
    expect((hosted as PendingBillingOperation).challenge).toBeUndefined()
  })

  it("keeps this tab's challenge verdict over a server echo of the same challenge", () => {
    const inProgress = reduceBillingOperation(
      polled(pending(), {
        authentication_state: 'requires_action',
        payment_intent_client_secret: 'pi_secret'
      }),
      { type: 'challenge_started' }
    )
    const failed = reduceBillingOperation(inProgress, {
      type: 'challenge_settled',
      outcome: 'failed'
    })
    const completed = reduceBillingOperation(inProgress, {
      type: 'challenge_settled',
      outcome: 'completed'
    })
    const echo = {
      authentication_state: 'requires_action',
      payment_intent_client_secret: 'pi_secret',
      action_url: 'https://billing.example/continue'
    } as const

    expect(polled(failed, echo)).toMatchObject({
      authenticationState: 'failed_retryable',
      challenge: { status: 'failed' },
      actionUrl: 'https://billing.example/continue'
    })
    expect(polled(completed, echo)).toMatchObject({
      authenticationState: 'processing',
      challenge: { status: 'completed' }
    })
    expect(
      (polled(completed, echo) as PendingBillingOperation).actionUrl
    ).toBeUndefined()

    const moved = polled(completed, {
      authentication_state: 'requires_action',
      payment_intent_client_secret: 'pi_other'
    })
    expect(moved).toMatchObject({
      authenticationState: 'requires_action',
      challenge: { clientSecret: 'pi_other', status: 'required' }
    })
  })

  it('carries the decline reason only while the customer may retry', () => {
    const declined = polled(pending(), {
      authentication_state: 'failed_retryable',
      decline_reason: 'card_declined'
    })
    expect(declined).toMatchObject({ declineReason: 'card_declined' })

    const processing = polled(declined, { authentication_state: 'processing' })
    expect(
      (processing as PendingBillingOperation).declineReason
    ).toBeUndefined()
  })

  it('switches presentation under the same id and restores a failed challenge on rollback', () => {
    const challenged = polled(pending(), {
      authentication_state: 'requires_action',
      payment_intent_client_secret: 'pi_secret',
      action_url: 'https://billing.example/continue'
    })
    const failed = reduceBillingOperation(
      reduceBillingOperation(challenged, { type: 'challenge_started' }),
      { type: 'challenge_settled', outcome: 'failed' }
    )

    const hosted = reduceBillingOperation(failed, {
      type: 'presentation_switched',
      presentation: 'hosted',
      hostedDestination: 'billing_web'
    })
    expect(hosted).toMatchObject({
      id: 'op-1',
      presentation: 'hosted',
      hostedDestination: 'billing_web',
      actionUrl: 'https://billing.example/continue',
      challenge: { clientSecret: 'pi_secret', status: 'failed' }
    })

    const rolledBack = reduceBillingOperation(hosted, {
      type: 'presentation_switched',
      presentation: 'embedded'
    })
    expect(rolledBack).toMatchObject({
      id: 'op-1',
      presentation: 'embedded',
      challenge: { clientSecret: 'pi_secret', status: 'required' }
    })
    expect(rolledBack.hostedDestination).toBeUndefined()
    expect(
      reduceBillingOperation(hosted, {
        type: 'presentation_switched',
        presentation: 'hosted',
        hostedDestination: 'billing_web'
      })
    ).toBe(hosted)
  })
})

describe('validateActionUrl', () => {
  it('accepts only absolute https links', () => {
    expect(validateActionUrl('https://billing.example/x')).toBe(
      'https://billing.example/x'
    )
    expect(validateActionUrl('http://billing.example/x')).toBeUndefined()
    expect(validateActionUrl('javascript:alert(1)')).toBeUndefined()
    expect(validateActionUrl('/relative')).toBeUndefined()
    expect(validateActionUrl(undefined)).toBeUndefined()
  })
})

describe('BillingOperationIdentity', () => {
  const core = {
    id: 'op-1',
    kind: 'subscription',
    scope: SCOPE,
    observedAt: 1_000,
    attemptStartedAt: 500
  } as const

  function readDestination(
    identity: BillingOperationIdentity
  ): string | undefined {
    return identity.hostedDestination
  }

  it('admits a hosted identity only with a destination', () => {
    const hosted: BillingOperationIdentity = {
      ...core,
      presentation: 'hosted',
      hostedDestination: 'billing_web'
    }

    // @ts-expect-error a hosted presentation without a destination
    const missing: BillingOperationIdentity = {
      ...core,
      presentation: 'hosted'
    }

    expect(readDestination(hosted)).toBe('billing_web')
    expect(missing.presentation).toBe('hosted')
    // @ts-expect-error the same gap crossing a function boundary
    expect(readDestination({ ...core, presentation: 'hosted' })).toBeUndefined()
  })

  it('refuses a destination on an embedded identity', () => {
    const embedded: BillingOperationIdentity = {
      ...core,
      presentation: 'embedded',
      // @ts-expect-error an embedded presentation is served from no origin
      hostedDestination: 'stripe'
    }

    expect(readDestination(embedded)).toBe('stripe')
    expect(
      readDestination({
        ...core,
        presentation: 'embedded',
        // @ts-expect-error the same conflict crossing a function boundary
        hostedDestination: 'stripe'
      })
    ).toBe('stripe')
  })
})
