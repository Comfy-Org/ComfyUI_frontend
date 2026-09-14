/**
 * The top-up command: one credit purchase mapped onto the shared billing
 * lifecycle. This module owns the request and response shapes and nothing
 * else — the status-read gate, single-flight, polling, routing, the pointer,
 * failure meaning, and telemetry all come from the lifecycle it runs on.
 *
 * The result is a command-level union rather than an extension of
 * `BillingErrorCode`: what a top-up can conclude (refused by capability,
 * declined by the provider, not available on this backend) is the command's
 * own vocabulary, and the terminal operation is embedded whenever one was
 * observed so a host reads the coded decline and recovery action from it.
 */
import {
  zCreateTopupRequest,
  zCreateTopupResponse
} from '@comfyorg/ingest-types/zod'

import type {
  BillingFailure,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import type { CapabilitiesReader } from './capabilities.js'
import type { CapabilityDenialReason } from './capabilityDenials.js'
import type { CreditsReader } from './credits.js'
import type {
  BillingOperationLifecycle,
  IssuedBillingOperation
} from './operationLifecycle.js'
import type {
  BillingOperationState,
  FailedBillingOperation
} from './operationState.js'
import { isTerminal } from './operationState.js'
import { readValidatedBillingResponse } from './sharedRead.js'

export const TOPUP_ROUTE = '/billing/topup'

/** The one coded error body this command acts on; every other code stays a `BillingFailure`. */
const NO_PAYMENT_METHOD_SERVER_CODE = 'NO_PAYMENT_METHOD'

type OperationIn<P extends BillingOperationState['phase']> = Extract<
  BillingOperationState,
  { readonly phase: P }
>

export interface TopupSucceeded {
  readonly status: 'ok'
  readonly operation: OperationIn<'succeeded'>
  /**
   * True once the balance read after settlement exceeds the one read before
   * the command. False is "payment received, credits pending": the purchase
   * settled and the balance has not caught up, or no baseline was readable.
   */
  readonly creditsReconciled: boolean
}

export interface TopupDeclined {
  readonly status: 'declined'
  readonly operation: FailedBillingOperation
}

/** The lifecycle stopped observing without a verdict; the id is the host's handle to support. */
export interface TopupUnsettled {
  readonly status: 'unsettled'
  readonly operation: OperationIn<'timed_out' | 'reconciliation_needed'>
}

/** The server resolved `can_top_up` false for this scope; nothing was sent. */
export interface TopupDenied {
  readonly status: 'error'
  readonly code: 'ACCESS_DENIED'
  readonly denial?: CapabilityDenialReason
}

/** The top-up route is not deployed on this backend. */
export interface TopupNotAvailable {
  readonly status: 'error'
  readonly code: 'NOT_AVAILABLE'
}

export interface TopupNoPaymentMethod {
  readonly status: 'error'
  readonly code: 'NO_PAYMENT_METHOD'
  readonly recoveryAction: 'replace_payment_method'
}

/** The amount fails the generated request contract; nothing was sent. */
export interface TopupInvalidAmount {
  readonly status: 'error'
  readonly code: 'INVALID_AMOUNT'
}

export type TopupFailure =
  | BillingFailure
  | TopupDenied
  | TopupNotAvailable
  | TopupNoPaymentMethod
  | TopupInvalidAmount

export type TopupResult =
  | TopupSucceeded
  | TopupDeclined
  | TopupUnsettled
  | TopupFailure

export interface CreateTopupCheckoutInput {
  readonly amountCents: number
  /**
   * Releases the capability read and the POST. Once the operation is adopted
   * the lifecycle owns it, and the wait follows it to a terminal state.
   */
  readonly signal?: AbortSignal
}

export interface TopupCommandOptions {
  readonly transport: BillingTransport
  readonly lifecycle: Pick<BillingOperationLifecycle, 'begin' | 'settled'>
  readonly capabilities: Pick<CapabilitiesReader, 'read' | 'invalidate'>
  readonly credits: Pick<CreditsReader, 'read'>
  /** One key per POST attempt: the backend dedupes on it and the transport replays a 401 under it. */
  readonly idempotencyKey?: () => string
}

export interface TopupCommand {
  createTopupCheckout: (input: CreateTopupCheckoutInput) => Promise<TopupResult>
}

const INVALID_AMOUNT = {
  status: 'error',
  code: 'INVALID_AMOUNT'
} as const satisfies TopupInvalidAmount

const SUPERSEDED = {
  status: 'error',
  code: 'SUPERSEDED'
} as const satisfies BillingFailure

function commandFailure(failure: BillingFailure): TopupFailure {
  if (failure.serverCode === NO_PAYMENT_METHOD_SERVER_CODE) {
    return {
      status: 'error',
      code: 'NO_PAYMENT_METHOD',
      recoveryAction: 'replace_payment_method'
    }
  }
  if (failure.httpStatus === 404) {
    return { status: 'error', code: 'NOT_AVAILABLE' }
  }
  return failure
}

export function createTopupCommand(options: TopupCommandOptions): TopupCommand {
  const {
    transport,
    lifecycle,
    capabilities,
    credits,
    idempotencyKey = () => crypto.randomUUID()
  } = options

  async function issue(
    amountCents: number,
    signal: AbortSignal | undefined
  ): Promise<BillingResult<IssuedBillingOperation>> {
    // The schema coerces `amount_cents` to a bigint, which the transport
    // could not serialize; the validated input is what travels, not the
    // parsed output.
    const body = {
      amount_cents: amountCents,
      idempotency_key: idempotencyKey()
    }
    const response = await readValidatedBillingResponse(
      transport,
      {
        method: 'POST',
        route: TOPUP_ROUTE,
        body,
        idempotencyKey: body.idempotency_key,
        ...(signal === undefined ? {} : { signal })
      },
      (raw) => zCreateTopupResponse.safeParse(raw)
    )
    if (response.status === 'error') return response
    // Adopted regardless of the response's own `status`: the first poll
    // settles a synchronous result and carries the decline reason, which the
    // POST response does not.
    return {
      status: 'ok',
      value: { operationId: response.value.data.billing_op_id }
    }
  }

  async function conclude(
    operation: BillingOperationState,
    baselineMicros: number | undefined
  ): Promise<TopupResult> {
    if (!isTerminal(operation)) return SUPERSEDED
    switch (operation.phase) {
      case 'succeeded': {
        capabilities.invalidate()
        const after = await credits.read()
        return {
          status: 'ok',
          operation,
          creditsReconciled:
            baselineMicros !== undefined &&
            after.status === 'ok' &&
            after.value.balance.amount_micros > baselineMicros
        }
      }
      case 'failed':
        return { status: 'declined', operation }
      case 'timed_out':
      case 'reconciliation_needed':
        return { status: 'unsettled', operation }
      case 'superseded':
        return SUPERSEDED
    }
  }

  async function createTopupCheckout(
    input: CreateTopupCheckoutInput
  ): Promise<TopupResult> {
    const { amountCents, signal } = input
    if (!zCreateTopupRequest.safeParse({ amount_cents: amountCents }).success) {
      return INVALID_AMOUNT
    }

    const allowed = await capabilities.read(
      signal === undefined ? {} : { signal }
    )
    if (allowed.status === 'error') return allowed
    if (!allowed.value.capabilities.can_top_up) {
      const denial = allowed.value.denials.can_top_up
      return {
        status: 'error',
        code: 'ACCESS_DENIED',
        ...(denial === undefined ? {} : { denial })
      }
    }

    const baseline = await credits.read()
    const baselineMicros =
      baseline.status === 'ok'
        ? baseline.value.balance.amount_micros
        : undefined

    // `begin` reports every failure as a `BillingFailure`; the command-level
    // meaning of its own POST failure is kept here so a status-read failure
    // is never mistaken for one.
    let issueFailure: TopupFailure | undefined
    const began = await lifecycle.begin('topup', async () => {
      const issued = await issue(amountCents, signal)
      if (issued.status === 'error') issueFailure = commandFailure(issued)
      return issued
    })
    if (began.status === 'error') return issueFailure ?? began

    const settled = lifecycle.settled(began.value.id)
    if (settled === undefined) return SUPERSEDED
    return conclude(await settled, baselineMicros)
  }

  return { createTopupCheckout }
}
