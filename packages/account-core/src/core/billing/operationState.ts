/**
 * One billing operation as the SDK sees it: a discriminated union over the
 * lifecycle a `billing_op_id` moves through, and the pure transition that
 * advances it. The identity is fixed at adoption and survives every
 * presentation change, so switching a checkout from the embedded challenge
 * to the hosted page (or back) is a transition on the same operation, never
 * a replacement one.
 *
 * The transition consumes the generated `BillingOpStatusResponse`. It reads
 * the coded `decline_reason` and `recovery_action` and never `error_message`,
 * so no server or payment-provider text can reach a consumer through this
 * state.
 */
import type { zBillingOpStatusResponse } from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingScope } from './billingScope.js'

export type BillingOpStatus = z.infer<typeof zBillingOpStatusResponse>

export type BillingOperationKind = 'subscription' | 'topup' | 'cancel'

/**
 * Where the customer completes the operation: the challenge this tab drives
 * through the host's payment-provider adapter, or the page behind the
 * server's `action_url`.
 */
export type BillingPresentation = 'embedded' | 'hosted'

/**
 * Which origin serves a hosted presentation: the provider page behind the
 * server's `action_url`, or the hosted billing app.
 */
export type HostedBillingDestination = 'stripe' | 'billing_web'

export type BillingDeclineReason = NonNullable<
  BillingOpStatus['decline_reason']
>
export type BillingRecoveryAction = NonNullable<
  BillingOpStatus['recovery_action']
>
export type BillingAuthenticationState = NonNullable<
  BillingOpStatus['authentication_state']
>
export type BillingOperationServerPhase = NonNullable<BillingOpStatus['phase']>

/**
 * The phases the contract defines as blocked on the customer. Neither advances
 * on its own, so an operation reporting one waits on them even before it has a
 * link to offer.
 */
export function isBlockedOnCustomerPhase(
  phase: BillingOperationServerPhase | null | undefined
): boolean {
  return (
    phase === 'awaiting_payment_method' || phase === 'awaiting_invoice_payment'
  )
}

export type BillingPresentationState =
  | { readonly presentation: 'embedded'; readonly hostedDestination?: never }
  | {
      readonly presentation: 'hosted'
      readonly hostedDestination: HostedBillingDestination
    }

export type BillingOperationIdentity = BillingPresentationState & {
  readonly id: string
  readonly kind: BillingOperationKind
  readonly scope: BillingScope
  /** When this tab began observing the operation; the poll budget counts from here. */
  readonly observedAt: number
  /** When the attempt began, before the command was issued; telemetry durations count from here. */
  readonly attemptStartedAt: number
}

/**
 * The in-page challenge for an embedded presentation. `completed` and
 * `failed` are this tab's verdicts and outrank a server echo of the same
 * challenge, so the presentation neither flaps back to "verify" after a
 * failure nor reopens the pay step mid-payment after a success.
 */
export interface EmbeddedChallenge {
  readonly clientSecret: string
  readonly status: 'required' | 'in_progress' | 'completed' | 'failed'
}

export type PendingBillingOperation = BillingOperationIdentity & {
  readonly phase: 'pending'
  /** The hosted continuation the server currently offers; https only. */
  readonly actionUrl?: string
  readonly challenge?: EmbeddedChallenge
  readonly authenticationState?: BillingAuthenticationState
  readonly serverPhase?: BillingOperationServerPhase
  /** Set while the customer's last attempt was declined and they may try again. */
  readonly declineReason?: BillingDeclineReason
  readonly recoveryAction?: BillingRecoveryAction
  /** True once the operation has ever waited on the customer; widens the poll budget. */
  readonly customerActionSeen: boolean
}

export type FailedBillingOperation = BillingOperationIdentity & {
  readonly phase: 'failed'
  readonly declineReason: BillingDeclineReason
  readonly recoveryAction?: BillingRecoveryAction
  readonly retryable: boolean
}

export type BillingOperationState =
  | PendingBillingOperation
  | (BillingOperationIdentity & { readonly phase: 'succeeded' })
  | FailedBillingOperation
  /** This tab's poll budget ran out; the server may still settle the operation. */
  | (BillingOperationIdentity & { readonly phase: 'timed_out' })
  /** The server cannot settle it without a human; surface the id to support. */
  | (BillingOperationIdentity & { readonly phase: 'reconciliation_needed' })
  /** The session or workspace changed underneath it; nothing here may be attributed to the new scope. */
  | (BillingOperationIdentity & { readonly phase: 'superseded' })

export type BillingOperationPhase = BillingOperationState['phase']

export type BillingOperationEvent =
  | { readonly type: 'status_polled'; readonly status: BillingOpStatus }
  | { readonly type: 'timed_out' }
  | { readonly type: 'superseded' }
  /** The operation could not be found under this scope. */
  | { readonly type: 'lost' }
  | {
      readonly type: 'presentation_switched'
      readonly presentation: 'hosted'
      readonly hostedDestination: HostedBillingDestination
    }
  | {
      readonly type: 'presentation_switched'
      readonly presentation: 'embedded'
    }
  | { readonly type: 'challenge_started' }
  | {
      readonly type: 'challenge_settled'
      readonly outcome: 'completed' | 'failed'
    }

export function isTerminal(
  state: BillingOperationState
): state is Exclude<BillingOperationState, PendingBillingOperation> {
  return state.phase !== 'pending'
}

/** A continuation link the SDK will hand to a host: absolute and https, nothing else. */
export function validateActionUrl(
  value: string | undefined
): string | undefined {
  if (value === undefined) return undefined
  try {
    return new URL(value).protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}

function presentationOf(
  state: BillingOperationState
): BillingPresentationState {
  return state.presentation === 'hosted'
    ? { presentation: 'hosted', hostedDestination: state.hostedDestination }
    : { presentation: 'embedded' }
}

function identityOf(state: BillingOperationState): BillingOperationIdentity {
  return {
    id: state.id,
    kind: state.kind,
    scope: state.scope,
    observedAt: state.observedAt,
    attemptStartedAt: state.attemptStartedAt,
    ...presentationOf(state)
  }
}

function withPhase<
  P extends Exclude<BillingOperationPhase, 'pending' | 'failed'>
>(
  state: BillingOperationState,
  phase: P
): BillingOperationIdentity & { readonly phase: P } {
  return { ...identityOf(state), phase }
}

/**
 * The server's `requires_action` is an echo of a challenge this tab already
 * settled when it names the same client secret (or none). The tab's verdict
 * stands until the intent actually moves.
 */
function echoesSettledChallenge(
  state: PendingBillingOperation,
  status: BillingOpStatus
): boolean {
  const challenge = state.challenge
  if (challenge === undefined) return false
  if (status.authentication_state !== 'requires_action') return false
  if (challenge.status !== 'completed' && challenge.status !== 'failed') {
    return false
  }
  return (
    status.payment_intent_client_secret === undefined ||
    status.payment_intent_client_secret === challenge.clientSecret
  )
}

function nextChallenge(
  state: PendingBillingOperation,
  status: BillingOpStatus
): EmbeddedChallenge | undefined {
  if (state.presentation !== 'embedded') return state.challenge
  const secret = status.payment_intent_client_secret
  if (secret === undefined) return state.challenge
  if (state.challenge?.clientSecret === secret) return state.challenge
  if (status.authentication_state !== 'requires_action') return state.challenge
  return { clientSecret: secret, status: 'required' }
}

function terminalFromStatus(
  state: PendingBillingOperation,
  status: BillingOpStatus
): BillingOperationState | undefined {
  if (status.status === 'succeeded') return withPhase(state, 'succeeded')
  if (status.status === 'failed') {
    return {
      ...identityOf(state),
      phase: 'failed',
      declineReason: status.decline_reason ?? 'generic',
      ...(status.recovery_action === undefined
        ? {}
        : { recoveryAction: status.recovery_action }),
      retryable: status.retryable === true
    }
  }
  if (
    status.status === 'reconciliation_needed' ||
    status.authentication_state === 'reconciliation_needed'
  ) {
    return withPhase(state, 'reconciliation_needed')
  }
  return undefined
}

/**
 * A link echoed while this tab's completed challenge is still processing
 * points at that same challenge; surfacing it would ask the customer to
 * redo a step they just finished.
 */
function nextActionUrl(
  state: PendingBillingOperation,
  status: BillingOpStatus,
  authenticationState: BillingAuthenticationState | undefined
): string | undefined {
  return state.challenge?.status === 'completed' &&
    authenticationState !== 'requires_action'
    ? state.actionUrl
    : validateActionUrl(status.action_url)
}

/**
 * A retryable failure served without a reason reads as `generic`, as a
 * terminal failure does, so the customer is offered the retry the state
 * promises. A challenge this tab saw fail supplies its own reason.
 */
function nextDeclineReason(
  state: PendingBillingOperation,
  status: BillingOpStatus,
  authenticationState: BillingAuthenticationState | undefined
): BillingDeclineReason | undefined {
  if (authenticationState !== 'failed_retryable') return undefined
  const known = status.decline_reason ?? state.declineReason
  if (known !== undefined || state.challenge?.status === 'failed') return known
  return 'generic'
}

function reducePending(
  state: PendingBillingOperation,
  status: BillingOpStatus
): BillingOperationState {
  if (status.id !== state.id) return state
  const terminal = terminalFromStatus(state, status)
  if (terminal !== undefined) return terminal

  const authenticationState = echoesSettledChallenge(state, status)
    ? state.authenticationState
    : status.authentication_state
  const actionUrl = nextActionUrl(state, status, authenticationState)
  const declineReason = nextDeclineReason(state, status, authenticationState)

  return {
    ...state,
    challenge: nextChallenge(state, status),
    authenticationState,
    actionUrl,
    serverPhase: status.phase,
    declineReason,
    recoveryAction: status.recovery_action,
    customerActionSeen:
      state.customerActionSeen ||
      actionUrl !== undefined ||
      isBlockedOnCustomerPhase(status.phase) ||
      status.authentication_state === 'requires_action'
  }
}

function settleChallenge(
  state: PendingBillingOperation,
  outcome: 'completed' | 'failed'
): PendingBillingOperation {
  if (state.challenge === undefined) return state
  const challenge = { ...state.challenge, status: outcome }
  if (outcome === 'failed') {
    return {
      ...state,
      challenge,
      authenticationState: 'failed_retryable',
      customerActionSeen: true
    }
  }
  return {
    ...state,
    challenge,
    authenticationState: 'processing',
    actionUrl: undefined,
    declineReason: undefined
  }
}

export function reduceBillingOperation(
  state: BillingOperationState,
  event: BillingOperationEvent
): BillingOperationState {
  if (state.phase !== 'pending') return state

  switch (event.type) {
    case 'status_polled':
      return reducePending(state, event.status)
    case 'timed_out':
      return withPhase(state, 'timed_out')
    case 'superseded':
      return withPhase(state, 'superseded')
    case 'lost':
      return withPhase(state, 'reconciliation_needed')
    case 'presentation_switched': {
      if (event.presentation === state.presentation) return state
      // The challenge record survives a hosted switch so a rollback keeps the
      // client secret; a failed challenge becomes required again on return.
      const { presentation, hostedDestination, ...rest } = state
      return event.presentation === 'hosted'
        ? {
            ...rest,
            presentation: 'hosted',
            hostedDestination: event.hostedDestination
          }
        : {
            ...rest,
            presentation: 'embedded',
            ...(state.challenge?.status === 'failed'
              ? { challenge: { ...state.challenge, status: 'required' } }
              : {})
          }
    }
    case 'challenge_started':
      return state.challenge?.status === 'required'
        ? { ...state, challenge: { ...state.challenge, status: 'in_progress' } }
        : state
    case 'challenge_settled':
      return settleChallenge(state, event.outcome)
  }
}
