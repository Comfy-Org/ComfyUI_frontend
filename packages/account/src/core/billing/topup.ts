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
  zCreateTopupCheckoutRequest,
  zCreateTopupCheckoutResponse,
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
import { isTerminal, validateActionUrl } from './operationState.js'
import { readValidatedBillingResponse } from './sharedRead.js'

export const TOPUP_ROUTE = '/billing/topup'
/**
 * The hosted variant: a provider-hosted Checkout session with no operation to
 * observe. The purchase happens on the returned page and the credits land
 * through a webhook, so completion is the host's return plus a balance watch.
 */
export const TOPUP_CHECKOUT_ROUTE = '/billing/topup/checkout'

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

/** The return URL fails the generated request contract; nothing was sent. */
export interface TopupInvalidReturnUrl {
  readonly status: 'error'
  readonly code: 'INVALID_RETURN_URL'
}

/**
 * A hosted Checkout session the host now sends the customer to. There is no
 * operation and none is invented: the host executes its `OpenUrlMode` on
 * `url`, and on return arms `createBalanceWatch` with `baselineMicros` to
 * learn that the credits landed.
 */
export interface HostedTopupCheckout {
  readonly status: 'ok'
  /** The provider-hosted Checkout page; https only. */
  readonly url: string
  /** The provider's session id, for support and log correlation. */
  readonly sessionId?: string
  /** The balance read before the session was created; absent when that read failed. */
  readonly baselineMicros?: number
}

export type HostedTopupCheckoutFailure =
  | BillingFailure
  | TopupDenied
  | TopupNotAvailable
  | TopupInvalidAmount
  | TopupInvalidReturnUrl

export type HostedTopupCheckoutResult =
  | HostedTopupCheckout
  | HostedTopupCheckoutFailure

export interface CreateHostedTopupCheckoutInput {
  readonly amountCents: number
  /** Where the provider returns the customer; the backend allowlists its origin. */
  readonly returnUrl: string
  readonly signal?: AbortSignal
}

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
  /**
   * The route Workshop and Platform ship on today. Unlike
   * `createTopupCheckout` it resolves as soon as the session exists, because
   * nothing about the purchase can be observed until the customer returns.
   */
  createHostedTopupCheckout: (
    input: CreateHostedTopupCheckoutInput
  ) => Promise<HostedTopupCheckoutResult>
}

const INVALID_AMOUNT = {
  status: 'error',
  code: 'INVALID_AMOUNT'
} as const satisfies TopupInvalidAmount

const INVALID_RETURN_URL = {
  status: 'error',
  code: 'INVALID_RETURN_URL'
} as const satisfies TopupInvalidReturnUrl

const NOT_AVAILABLE = {
  status: 'error',
  code: 'NOT_AVAILABLE'
} as const satisfies TopupNotAvailable

function validateHostedCheckoutInput(
  input: CreateHostedTopupCheckoutInput
): TopupInvalidAmount | TopupInvalidReturnUrl | undefined {
  const parsed = zCreateTopupCheckoutRequest.safeParse({
    amount_cents: input.amountCents,
    return_url: input.returnUrl
  })
  if (parsed.success) return undefined
  const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]))
  return fields.has('amount_cents') ? INVALID_AMOUNT : INVALID_RETURN_URL
}

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
  if (failure.httpStatus === 404) return NOT_AVAILABLE
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

  async function readTopupEligibility(
    signal: AbortSignal | undefined
  ): Promise<BillingFailure | TopupDenied | undefined> {
    const allowed = await capabilities.read(
      signal === undefined ? {} : { signal }
    )
    if (allowed.status === 'error') return allowed
    if (allowed.value.capabilities.can_top_up) return undefined
    const denial = allowed.value.denials.can_top_up
    return {
      status: 'error',
      code: 'ACCESS_DENIED',
      ...(denial === undefined ? {} : { denial })
    }
  }

  async function createTopupCheckout(
    input: CreateTopupCheckoutInput
  ): Promise<TopupResult> {
    const { amountCents, signal } = input
    if (!zCreateTopupRequest.safeParse({ amount_cents: amountCents }).success) {
      return INVALID_AMOUNT
    }

    const refused = await readTopupEligibility(signal)
    if (refused) return refused

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

  async function issueHostedCheckout(
    input: CreateHostedTopupCheckoutInput
  ): Promise<BillingResult<Pick<HostedTopupCheckout, 'url' | 'sessionId'>>> {
    const body = {
      amount_cents: input.amountCents,
      return_url: input.returnUrl,
      idempotency_key: idempotencyKey()
    }
    const response = await readValidatedBillingResponse(
      transport,
      {
        method: 'POST',
        route: TOPUP_CHECKOUT_ROUTE,
        body,
        idempotencyKey: body.idempotency_key,
        ...(input.signal === undefined ? {} : { signal: input.signal })
      },
      (raw) => zCreateTopupCheckoutResponse.safeParse(raw)
    )
    if (response.status === 'error') return response

    // The generated contract only requires a URL; the page a host will open
    // on the customer's behalf has to be https as well, like every
    // continuation the lifecycle hands out.
    const { data, httpStatus } = response.value
    const url = validateActionUrl(data.checkout_url)
    if (url === undefined) {
      return { status: 'error', code: 'MALFORMED_RESPONSE', httpStatus }
    }
    return {
      status: 'ok',
      value: {
        url,
        ...(data.session_id === undefined ? {} : { sessionId: data.session_id })
      }
    }
  }

  async function createHostedTopupCheckout(
    input: CreateHostedTopupCheckoutInput
  ): Promise<HostedTopupCheckoutResult> {
    const invalid = validateHostedCheckoutInput(input)
    if (invalid) return invalid

    const refused = await readTopupEligibility(input.signal)
    if (refused) return refused

    const baseline = await credits.read()
    const session = await issueHostedCheckout(input)
    if (session.status === 'error') {
      return session.httpStatus === 404 ? NOT_AVAILABLE : session
    }
    return {
      status: 'ok',
      ...session.value,
      ...(baseline.status === 'ok'
        ? { baselineMicros: baseline.value.balance.amount_micros }
        : {})
    }
  }

  return { createTopupCheckout, createHostedTopupCheckout }
}
