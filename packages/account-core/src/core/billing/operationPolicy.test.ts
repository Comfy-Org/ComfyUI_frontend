import { describe, expect, it } from 'vitest'

import { OPERATION_POLL_TIMING, nextPollDelayMs } from './operationPolicy.js'
import type { PendingBillingOperation } from './operationState.js'
import type { PaymentStep } from './paymentProjection.js'
import { projectPaymentStep } from './paymentProjection.js'

const BASE = {
  id: 'op-1',
  kind: 'subscription',
  scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
  observedAt: 0,
  attemptStartedAt: 0,
  phase: 'pending',
  customerActionSeen: true
} as const

type Overrides = Partial<
  Omit<PendingBillingOperation, 'presentation' | 'hostedDestination'>
>

function embedded(overrides: Overrides = {}): PendingBillingOperation {
  return { ...BASE, presentation: 'embedded', ...overrides }
}

function hosted(overrides: Overrides = {}): PendingBillingOperation {
  return {
    ...BASE,
    presentation: 'hosted',
    hostedDestination: 'stripe',
    ...overrides
  }
}

const STEPS_WITH_AN_ACTION: ReadonlySet<PaymentStep> = new Set([
  'verifying',
  'declined',
  'processing_error'
])

const CHALLENGE = { clientSecret: 'pi_secret' } as const

describe('nextPollDelayMs', () => {
  it.for([
    {
      name: 'a blocked phase whose authentication state still reads processing',
      state: embedded({
        serverPhase: 'awaiting_invoice_payment',
        authenticationState: 'processing'
      }),
      parked: false
    },
    {
      name: 'a required embedded challenge',
      state: embedded({
        serverPhase: 'awaiting_invoice_payment',
        authenticationState: 'requires_action',
        challenge: { ...CHALLENGE, status: 'required' }
      }),
      parked: true
    },
    {
      name: 'a completed challenge the server has not caught up with',
      state: embedded({
        serverPhase: 'awaiting_invoice_payment',
        authenticationState: 'processing',
        challenge: { ...CHALLENGE, status: 'completed' }
      }),
      parked: false
    },
    {
      name: 'a failed challenge awaiting a retry',
      state: embedded({
        authenticationState: 'failed_retryable',
        challenge: { ...CHALLENGE, status: 'failed' }
      }),
      parked: true
    },
    {
      name: 'a hosted operation blocked before its page exists',
      state: hosted({ serverPhase: 'awaiting_invoice_payment' }),
      parked: false
    },
    {
      name: 'a hosted operation with a page to visit',
      state: hosted({
        serverPhase: 'awaiting_invoice_payment',
        actionUrl: 'https://billing.example/continue'
      }),
      parked: true
    },
    {
      name: 'a declined attempt awaiting a retry',
      state: embedded({
        authenticationState: 'failed_retryable',
        declineReason: 'card_declined'
      }),
      parked: true
    }
  ])(
    'parks $name only when the customer can act: $parked',
    ({ state, parked }) => {
      const delay = nextPollDelayMs(state, OPERATION_POLL_TIMING.maxMs)
      const step = projectPaymentStep(state, 'preview').step

      expect(delay === OPERATION_POLL_TIMING.parkedMs).toBe(parked)
      expect(parked && !STEPS_WITH_AN_ACTION.has(step)).toBe(false)
    }
  )
})

describe('nextPollDelayMs while blocked with no customer action', () => {
  const actionless = embedded({
    serverPhase: 'awaiting_invoice_payment',
    authenticationState: 'processing'
  })
  const window = OPERATION_POLL_TIMING.actionDiscoveryMs

  it.for([
    { name: 'just entered', waitedMs: 0, parked: false },
    { name: 'inside the window', waitedMs: window - 1, parked: false },
    { name: 'at the end of the window', waitedMs: window, parked: true },
    { name: 'long past the window', waitedMs: 20 * window, parked: true }
  ])('parks when $name: $parked', ({ waitedMs, parked }) => {
    expect(
      nextPollDelayMs(actionless, OPERATION_POLL_TIMING.maxMs, waitedMs)
    ).toBe(
      parked ? OPERATION_POLL_TIMING.parkedMs : OPERATION_POLL_TIMING.maxMs
    )
  })

  it('ignores the wait for an operation not blocked on the customer', () => {
    const inProgress = embedded({ serverPhase: 'in_progress' })

    expect(
      nextPollDelayMs(inProgress, OPERATION_POLL_TIMING.maxMs, 20 * window)
    ).toBe(OPERATION_POLL_TIMING.maxMs)
  })
})
