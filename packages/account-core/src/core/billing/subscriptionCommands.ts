/**
 * The subscription commands on the shared operation lifecycle: subscribe,
 * resubscribe, cancel, and the payment portal. Each one encodes its request
 * against the generated contract, issues it through `lifecycle.begin`, and
 * waits for the settled operation; polling, routing, recovery, and telemetry
 * stay in the lifecycle. `previewSubscribe` sits beside them without a
 * lifecycle: it only quotes a change.
 *
 * Eligibility is decided from the server's own status fields, never from a
 * client-side notion of the plan (`docs/billing-command-eligibility.md`).
 * Server codes are matched against the closed set named here; a code outside
 * it reaches the caller only as the transport's coded failure.
 */
import {
  zCancelSubscriptionResponse2,
  zPaymentPortalResponse,
  zPreviewSubscribeRequest,
  zPreviewSubscribeResponse,
  zResubscribeResponse,
  zSubscribeRequest,
  zSubscribeResponse
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingFailure, BillingTransport } from './billingContracts.js'
import { matchesServerCode } from './billingContracts.js'
import type { CapabilitiesReader } from './capabilities.js'
import type { CreditsReader } from './credits.js'
import type {
  BillingOperationLifecycle,
  IssuedBillingOperation
} from './operationLifecycle.js'
import type {
  BillingOperationKind,
  BillingOperationState,
  PendingBillingOperation
} from './operationState.js'
import { validateActionUrl } from './operationState.js'
import { readValidatedBillingResponse } from './sharedRead.js'
import type { BillingStatusData, BillingStatusReader } from './status.js'

export const SUBSCRIBE_ROUTE = '/billing/subscribe'
export const RESUBSCRIBE_ROUTE = '/billing/subscription/resubscribe'
export const CANCEL_SUBSCRIPTION_ROUTE = '/billing/subscription/cancel'
export const PAYMENT_PORTAL_ROUTE = '/billing/payment-portal'
export const PREVIEW_SUBSCRIBE_ROUTE = '/billing/preview-subscribe'

/** The closed set of `serverCode` values these commands act on. */
const NO_ACTIVE_SUBSCRIPTION_SERVER_CODE = 'NO_ACTIVE_SUBSCRIPTION'
const REACTIVATION_CONFIRMATION_REQUIRED_SERVER_CODE =
  'REACTIVATION_CONFIRMATION_REQUIRED'
const NOT_SCHEDULED_FOR_CANCELLATION_SERVER_CODE =
  'NOT_SCHEDULED_FOR_CANCELLATION'
const ALREADY_CANCELED_SERVER_CODE = 'ALREADY_CANCELED'

export type SubscribeInput = z.infer<typeof zSubscribeRequest>

export type TerminalBillingOperation = Exclude<
  BillingOperationState,
  PendingBillingOperation
>

/** Outcomes a subscription command adds to the shared `BillingErrorCode` set. */
export type SubscriptionCommandCode =
  /** The input fails the generated request contract; nothing was sent. */
  | 'INVALID_REQUEST'
  /** `confirmation_token` and `saved_payment_method_id` were both given. */
  | 'CONFLICTING_PAYMENT_METHOD'
  /** The server wants the host to re-preview and resend with `confirm_reactivation`. */
  | 'REACTIVATION_CONFIRMATION_REQUIRED'
  | 'NO_ACTIVE_SUBSCRIPTION'
  /** The server asked for a hosted payment step but offered no page for it. */
  | 'MISSING_PAYMENT_METHOD_URL'

export type SubscriptionCommandFailure =
  | BillingFailure
  | { readonly status: 'error'; readonly code: SubscriptionCommandCode }

export interface SubscriptionCommandOutcome {
  readonly phase: TerminalBillingOperation['phase']
  /** Absent when the requested state already held and nothing was issued. */
  readonly operation?: TerminalBillingOperation
}

export type SubscriptionCommandResult =
  | { readonly status: 'ok'; readonly value: SubscriptionCommandOutcome }
  | SubscriptionCommandFailure

export type PaymentPortalResult =
  | { readonly status: 'ok'; readonly value: { readonly url: string } }
  | BillingFailure

/**
 * The quote the server returns for a plan change, in the generated field names.
 *
 * Its strings are product copy, not `serverCode`'s kind of machine identifier:
 * a `discounts[]` entry describes a discount the server applied, and a
 * `promotion` one carries back the very `promotionCode` the caller sent, so a
 * host renders `code` and `name` rather than matching them.
 */
export type SubscriptionPreview = z.infer<typeof zPreviewSubscribeResponse>

export interface PreviewSubscribeInput {
  readonly planSlug: string
  readonly promotionCode?: string
  readonly teamCreditStopId?: string
  readonly checkoutAttemptId?: string
}

export interface PreviewSubscribeOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export type PreviewSubscribeResult =
  | { readonly status: 'ok'; readonly value: SubscriptionPreview }
  | SubscriptionCommandFailure

export interface BillingCommandsOptions {
  readonly transport: BillingTransport
  readonly lifecycle: BillingOperationLifecycle
  readonly statusReader: BillingStatusReader
  readonly capabilities: CapabilitiesReader
  readonly credits: CreditsReader
  /** One key per attempt; the backend's dedupe key and the transport's replay gate. */
  readonly idempotencyKey?: () => string
}

export interface BillingCommands {
  subscribe: (input: SubscribeInput) => Promise<SubscriptionCommandResult>
  /**
   * Quotes a plan change without issuing an operation or touching the
   * capability cache: a read the backend happens to shape as a POST. It sends
   * no idempotency key, so a stale token surfaces as the transient
   * `REQUEST_FAILED` that callers already retry rather than as a denial.
   */
  previewSubscribe: (
    input: PreviewSubscribeInput,
    options?: PreviewSubscribeOptions
  ) => Promise<PreviewSubscribeResult>
  resubscribe: () => Promise<SubscriptionCommandResult>
  cancelSubscription: () => Promise<SubscriptionCommandResult>
  /** Returns the portal URL; the host decides how to open it. */
  openPaymentPortal: (input: {
    readonly returnUrl?: string
  }) => Promise<PaymentPortalResult>
}

type IssueOutcome =
  | { readonly status: 'ok'; readonly value: IssuedBillingOperation }
  /** The server refused because the requested state already holds. */
  | { readonly status: 'already_held' }
  | SubscriptionCommandFailure

const ALREADY_HELD: SubscriptionCommandResult = {
  status: 'ok',
  value: { phase: 'succeeded' }
}

function coded(code: SubscriptionCommandCode): SubscriptionCommandFailure {
  return { status: 'error', code }
}

type Eligibility = 'free' | 'active' | 'canceled'

function eligibilityOf(status: BillingStatusData): Eligibility {
  const paid =
    status.is_active &&
    status.subscription_tier !== undefined &&
    status.subscription_tier !== 'FREE'
  if (!paid) return 'free'
  return status.subscription_status === 'canceled' ? 'canceled' : 'active'
}

/**
 * A server code the caller's request already satisfies is a success, but
 * only from a 4xx: a 5xx echoing the code is an upstream failure that
 * happens to carry it, and the requested state cannot be assumed to hold.
 */
function alreadyInRequestedState(
  failure: BillingFailure,
  serverCode: string
): boolean {
  return (
    matchesServerCode(failure, serverCode) &&
    failure.httpStatus !== undefined &&
    failure.httpStatus >= 400 &&
    failure.httpStatus < 500
  )
}

function mapServerCode(
  failure: BillingFailure,
  alreadyHeldCode: string
): IssueOutcome {
  if (alreadyInRequestedState(failure, alreadyHeldCode)) {
    return { status: 'already_held' }
  }
  return matchesServerCode(failure, NO_ACTIVE_SUBSCRIPTION_SERVER_CODE)
    ? coded('NO_ACTIVE_SUBSCRIPTION')
    : failure
}

function dropEmpty(value: string | undefined): string | undefined {
  return value === '' ? undefined : value
}

function previewRequestBody(input: PreviewSubscribeInput): unknown {
  const { planSlug, promotionCode, teamCreditStopId, checkoutAttemptId } = input
  return {
    plan_slug: planSlug,
    ...(promotionCode === undefined ? {} : { promotion_code: promotionCode }),
    ...(teamCreditStopId === undefined
      ? {}
      : { team_credit_stop_id: teamCreditStopId }),
    ...(checkoutAttemptId === undefined
      ? {}
      : { checkout_attempt_id: checkoutAttemptId })
  }
}

export function createBillingCommands(
  options: BillingCommandsOptions
): BillingCommands {
  const {
    transport,
    lifecycle,
    statusReader,
    capabilities,
    credits,
    idempotencyKey = () => crypto.randomUUID()
  } = options

  async function refreshAfterSuccess(): Promise<void> {
    capabilities.invalidate()
    await Promise.all([credits.read(), statusReader.read()])
  }

  function post<T>(
    route: string,
    body: unknown,
    parse: (body: unknown) => z.SafeParseReturnType<unknown, T>,
    key?: string
  ) {
    return readValidatedBillingResponse(
      transport,
      {
        method: 'POST',
        route,
        body,
        ...(key === undefined ? {} : { idempotencyKey: key })
      },
      parse
    )
  }

  async function settle(
    kind: BillingOperationKind,
    issue: () => Promise<IssueOutcome>
  ): Promise<SubscriptionCommandResult> {
    // The lifecycle carries only the shared codes; the command's own verdict
    // waits here for `begin` to return.
    const verdict: { value?: Exclude<IssueOutcome, { status: 'ok' }> } = {}
    const began = await lifecycle.begin(kind, async () => {
      const outcome = await issue()
      if (outcome.status === 'ok') return outcome
      verdict.value = outcome
      return { status: 'error', code: 'REQUEST_FAILED' }
    })
    if (verdict.value !== undefined) {
      if (verdict.value.status !== 'already_held') return verdict.value
      await refreshAfterSuccess()
      return ALREADY_HELD
    }
    if (began.status === 'error') return began

    const settled = lifecycle.settled(began.value.id)
    const operation = settled === undefined ? began.value : await settled
    if (operation.phase === 'pending') {
      return { status: 'error', code: 'SUPERSEDED' }
    }
    if (operation.phase === 'succeeded') await refreshAfterSuccess()
    return { status: 'ok', value: { phase: operation.phase, operation } }
  }

  async function issueSubscribe(input: SubscribeInput): Promise<IssueOutcome> {
    const key = idempotencyKey()
    const response = await post(
      SUBSCRIBE_ROUTE,
      { ...input, idempotency_key: key },
      (body) => zSubscribeResponse.safeParse(body),
      key
    )
    if (response.status === 'error') {
      return matchesServerCode(
        response,
        REACTIVATION_CONFIRMATION_REQUIRED_SERVER_CODE
      )
        ? coded('REACTIVATION_CONFIRMATION_REQUIRED')
        : response
    }
    const { billing_op_id, status, payment_method_url } = response.value.data
    if (status !== 'needs_payment_method') {
      return { status: 'ok', value: { operationId: billing_op_id } }
    }
    if (payment_method_url === undefined) {
      return coded('MISSING_PAYMENT_METHOD_URL')
    }
    return {
      status: 'ok',
      value: { operationId: billing_op_id, actionUrl: payment_method_url }
    }
  }

  async function issueResubscribe(): Promise<IssueOutcome> {
    const key = idempotencyKey()
    const response = await post(
      RESUBSCRIBE_ROUTE,
      { idempotency_key: key },
      (body) => zResubscribeResponse.safeParse(body),
      key
    )
    if (response.status === 'error') {
      return mapServerCode(response, NOT_SCHEDULED_FOR_CANCELLATION_SERVER_CODE)
    }
    return {
      status: 'ok',
      value: { operationId: response.value.data.billing_op_id }
    }
  }

  async function issueCancel(): Promise<IssueOutcome> {
    const key = idempotencyKey()
    const response = await post(
      CANCEL_SUBSCRIPTION_ROUTE,
      { idempotency_key: key },
      (body) => zCancelSubscriptionResponse2.safeParse(body),
      key
    )
    if (response.status === 'error') {
      return mapServerCode(response, ALREADY_CANCELED_SERVER_CODE)
    }
    return {
      status: 'ok',
      value: { operationId: response.value.data.billing_op_id }
    }
  }

  const resubscribe = () => settle('subscription', issueResubscribe)

  async function subscribe(
    input: SubscribeInput
  ): Promise<SubscriptionCommandResult> {
    const confirmationToken = dropEmpty(input.confirmation_token)
    const savedPaymentMethodId = dropEmpty(input.saved_payment_method_id)
    if (confirmationToken !== undefined && savedPaymentMethodId !== undefined) {
      return coded('CONFLICTING_PAYMENT_METHOD')
    }
    // JSON drops `undefined` but keeps `''`, so an empty credential would
    // reach the server as a present-but-meaningless value.
    const request: SubscribeInput = {
      ...input,
      confirmation_token: confirmationToken,
      saved_payment_method_id: savedPaymentMethodId
    }
    if (!zSubscribeRequest.safeParse(request).success) {
      return coded('INVALID_REQUEST')
    }

    const status = await statusReader.read()
    if (status.status === 'error') return status
    switch (eligibilityOf(status.value.status)) {
      case 'active':
        return ALREADY_HELD
      case 'canceled':
        return resubscribe()
      case 'free':
        return settle('subscription', () => issueSubscribe(request))
    }
  }

  async function previewSubscribe(
    input: PreviewSubscribeInput,
    options: PreviewSubscribeOptions = {}
  ): Promise<PreviewSubscribeResult> {
    const body = previewRequestBody(input)
    if (!zPreviewSubscribeRequest.safeParse(body).success) {
      return coded('INVALID_REQUEST')
    }
    const response = await readValidatedBillingResponse(
      transport,
      {
        method: 'POST',
        route: PREVIEW_SUBSCRIBE_ROUTE,
        body,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        ...(options.timeoutMs === undefined
          ? {}
          : { timeoutMs: options.timeoutMs })
      },
      (raw) => zPreviewSubscribeResponse.safeParse(raw)
    )
    return response.status === 'error'
      ? response
      : { status: 'ok', value: response.value.data }
  }

  async function openPaymentPortal(input: {
    readonly returnUrl?: string
  }): Promise<PaymentPortalResult> {
    const response = await post(
      PAYMENT_PORTAL_ROUTE,
      input.returnUrl === undefined ? {} : { return_url: input.returnUrl },
      (body) => zPaymentPortalResponse.safeParse(body)
    )
    if (response.status === 'error') return response
    const url = validateActionUrl(response.value.data.url)
    if (url === undefined) {
      return {
        status: 'error',
        code: 'MALFORMED_RESPONSE',
        httpStatus: response.value.httpStatus
      }
    }
    return { status: 'ok', value: { url } }
  }

  return {
    subscribe,
    previewSubscribe,
    resubscribe,
    cancelSubscription: () => settle('cancel', issueCancel),
    openPaymentPortal
  }
}
