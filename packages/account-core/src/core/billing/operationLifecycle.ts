/**
 * The operation lifecycle every billing command sits on: adopt a
 * `billing_op_id`, observe it to a terminal state, and reattach to it after a
 * reload, a focus, or a return to the workspace — without ever creating a
 * replacement operation. Commands issue the request; this owns everything
 * that happens to the id afterwards.
 *
 * Framework-free by construction. Nothing here opens a URL, drives a
 * payment-provider challenge, or listens to a document: a host renders the
 * state (`actionUrl`, `challenge`), performs those effects itself, and
 * reports back through `reportChallenge*` and `wake`.
 *
 * Behavior is ported from the cloud app's `billingOperationStore` — the
 * cadence, the budgets, the parked-on-customer rules, the challenge echo
 * suppression — and from the pending-checkout pointer's terminal rule; the
 * wiring onto the scope source, the scope tracker, and the generated
 * contract is new.
 */

import {
  BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT,
  BILLING_OPERATION_TELEMETRY_EVENT
} from '../../telemetry.js'
import type {
  BillingFailure,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import type {
  BillingScope,
  BillingScopeContext,
  BillingScopeSource
} from './billingScope.js'
import { createBillingScopeTracker } from './billingScope.js'
import type {
  BillingOperationPointer,
  BillingOperationPointerStorage,
  OperationPointerStore
} from './operationPointer.js'
import {
  NO_POINTER_STORE,
  createOperationPointerStore
} from './operationPointer.js'
import {
  hasExhaustedPollBudget,
  isWaitingOnCustomerWithoutAction,
  nextPollDelayMs
} from './operationPolicy.js'
import type {
  BillingDeclineReason,
  BillingOpStatus,
  BillingOperationEvent,
  BillingOperationKind,
  BillingOperationState,
  BillingPresentation,
  BillingPresentationState,
  HostedBillingDestination,
  PendingBillingOperation
} from './operationState.js'
import {
  BillingOpStatusSchema,
  isGrantLanding,
  isTerminal,
  reduceBillingOperation,
  validateActionUrl
} from './operationState.js'
import type { PaymentFrictionSignal } from './paymentFriction.js'
import type {
  CheckoutHostedStep,
  CheckoutRedirectNavigation
} from './telemetry/checkoutRedirectEvent.js'
import type { CheckoutMethodKind } from './telemetry/checkoutJourney.js'
import { paymentFrictionBetween } from './paymentFriction.js'
import { selectBillingPresentation } from './presentation.js'
import { readValidatedBillingResponse } from './sharedRead.js'
import type { BillingStatusData, BillingStatusReader } from './status.js'

/** Settled, but a later read may still change what the operation reports. */
function isStillSettling(state: BillingOperationState): boolean {
  return state.phase === 'reconciliation_needed' || isGrantLanding(state)
}

export function operationRoute(operationId: string): string {
  return `/billing/ops/${encodeURIComponent(operationId)}`
}

/** What a command learned from the backend when it issued the operation. */
export interface IssuedBillingOperation {
  readonly operationId: string
  /** A hosted continuation the response already carried (`payment_method_url`, `action_url`). */
  readonly actionUrl?: string
  /** An in-page challenge the response already carried. */
  readonly clientSecret?: string
}

export type BillingOperationFailureCategory =
  | 'provider_decline'
  | 'api_rejected'
  | 'poll_timeout'
  | 'reconciliation_needed'
  | 'stale_operation'

type HostedStepEventName =
  | typeof BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT.redirectStarted
  | typeof BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT.returned

type BillingOperationTelemetryEventName = Exclude<
  | (typeof BILLING_OPERATION_TELEMETRY_EVENT)[keyof typeof BILLING_OPERATION_TELEMETRY_EVENT]
  | (typeof BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT)[keyof typeof BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT],
  HostedStepEventName
>

/** A hosted step this tab handed the customer to. */
interface HostedStepVisit {
  readonly destination: HostedBillingDestination
  readonly step: CheckoutHostedStep
  readonly navigation: CheckoutRedirectNavigation
  readonly method_kind?: CheckoutMethodKind
}

interface BillingOperationTelemetryBase {
  readonly billing_op_id: string
  readonly operation_type: BillingOperationKind
  readonly presentation: BillingPresentation
  /** True when this tab reattached to an operation it did not issue. */
  readonly resumed: boolean
}

export type BillingOperationTelemetryEvent = BillingOperationTelemetryBase &
  (
    | {
        readonly name: BillingOperationTelemetryEventName
        readonly failure_category?: BillingOperationFailureCategory
        readonly decline_reason?: BillingDeclineReason
        /** From the attempt's start, so a resumed operation reports its whole life. */
        readonly duration_ms?: number
      }
    | (HostedStepVisit & { readonly name: HostedStepEventName })
  )

export type PresentationSwitchOutcome =
  | 'switched'
  | 'unchanged'
  /** The server has offered no hosted continuation yet. */
  | 'no_hosted_url'
  /** The host cannot drive a challenge, or none has been issued for this operation. */
  | 'embedded_unavailable'
  | 'not_pending'
  | 'unknown_operation'

export interface BillingOperationLifecycleOptions {
  readonly transport: BillingTransport
  /** Where the core learns which user, workspace, and role it runs as. */
  readonly scopeSource: BillingScopeSource
  /** The Phase 2 status reader; consulted before every start and recovery. */
  readonly statusReader: BillingStatusReader
  /** Tab-local storage for the operation pointer; absent means nothing survives a reload. */
  readonly pointerStorage?: BillingOperationPointerStorage
  /**
   * Keep the pointer of an operation that succeeded or needs reconciliation,
   * for a host whose page is the checkout itself: a revisit reads it back
   * through `recover({ includeSettled: true })`. A plain `recover` never
   * sees it, so every other caller recovers exactly what it did before.
   */
  readonly retainSettledPointer?: boolean
  /** Whether the host can drive an in-page challenge right now. Absent routes everything hosted. */
  readonly embeddedCheckoutAvailable?: () => boolean
  /** Which origin serves a hosted page right now. Absent keeps every hosted operation on the provider page. */
  readonly hostedDestination?: () => HostedBillingDestination
  readonly onTelemetry?: (event: BillingOperationTelemetryEvent) => void
  readonly now?: () => number
}

export interface BillingRecoverOptions {
  /**
   * Also read back the operation a retained pointer says already settled, so
   * the checkout that issued it can show it finished. Only a lifecycle with
   * `retainSettledPointer` keeps one.
   */
  readonly includeSettled?: boolean
}

export interface BillingOperationLifecycle {
  /**
   * Runs a command on the lifecycle: single-flight per kind, the backend's
   * pending operation adopted instead of a second one issued, and the
   * issued id observed from the moment it exists. Resolves once the
   * operation is adopted, not once it settles — see `settled`.
   */
  begin: (
    kind: BillingOperationKind,
    issue: (
      scope: BillingScope
    ) => Promise<BillingResult<IssuedBillingOperation>>
  ) => Promise<BillingResult<BillingOperationState>>
  /**
   * Reattaches to whatever this scope is already waiting on: the backend's
   * pending operation first, then the tab-local pointer. Resolves undefined
   * when there is nothing to recover.
   */
  recover: (
    options?: BillingRecoverOptions
  ) => Promise<BillingResult<BillingOperationState | undefined>>
  /** The host became visible or focused: poll every pending operation now. */
  wake: () => void
  /** Moves the operation between presentations under the same id. */
  switchPresentation: (
    operationId: string,
    presentation: BillingPresentation
  ) => PresentationSwitchOutcome
  /**
   * The host opened the operation's hosted step. A redirect is remembered in
   * the pointer, so the page it returns to reports the return; a new tab
   * reports it on the next wake.
   */
  reportHostedStepOpened: (
    operationId: string,
    navigation: CheckoutRedirectNavigation,
    methodKind?: CheckoutMethodKind
  ) => void
  /** The host began driving the operation's challenge; polling pauses until it settles. */
  reportChallengeStarted: (operationId: string) => void
  reportChallengeSettled: (
    operationId: string,
    outcome: 'completed' | 'failed'
  ) => void
  get: (operationId: string) => BillingOperationState | undefined
  getSnapshot: () => readonly BillingOperationState[]
  subscribe: (listener: (state: BillingOperationState) => void) => () => void
  /** Resolves with the terminal state; undefined for an id this lifecycle never adopted. */
  settled: (operationId: string) => Promise<BillingOperationState> | undefined
  dispose: () => void
}

const NOT_AUTHENTICATED = {
  status: 'error',
  code: 'NOT_AUTHENTICATED'
} as const satisfies BillingFailure

const SUPERSEDED = {
  status: 'error',
  code: 'SUPERSEDED'
} as const satisfies BillingFailure

const OPERATION_ALREADY_PENDING = {
  status: 'error',
  code: 'OPERATION_ALREADY_PENDING'
} as const satisfies BillingFailure

/** A command attempt still settling, kept with the scope that issued it. */
interface InFlightCommand {
  readonly context: BillingScopeContext
  readonly promise: Promise<BillingResult<BillingOperationState>>
}

interface OperationRecord {
  state: BillingOperationState
  readonly context: BillingScopeContext
  readonly resumed: boolean
  delayMs: number | undefined
  /** When the operation last became blocked on the customer with no action here. */
  waitingWithoutActionSince: number | undefined
  timer: ReturnType<typeof setTimeout> | undefined
  inFlightPoll: Promise<void> | undefined
  /** A hosted step this tab opened in a new tab; the next wake is the customer back. */
  awaitingReturn: HostedStepVisit | undefined
  readonly settled: Promise<BillingOperationState>
  resolveSettled: (state: BillingOperationState) => void
}

interface AdoptInput {
  readonly id: string
  readonly kind: BillingOperationKind
  readonly context: BillingScopeContext
  readonly presentation: BillingPresentation
  readonly actionUrl?: string
  readonly clientSecret?: string
  readonly attemptStartedAt: number
  readonly resumed: boolean
  readonly awaitedHere: boolean
  /** A status already read for this operation; observed from it instead of polled again. */
  readonly initialStatus?: BillingOpStatus
  /** The hosted step a redirect left this page for; adopting it is the return. */
  readonly returnedFrom?: BillingOperationPointer['redirect']
}

type ResumedAttempt = Pick<
  AdoptInput,
  | 'presentation'
  | 'attemptStartedAt'
  | 'resumed'
  | 'awaitedHere'
  | 'returnedFrom'
>

/** The attempt a pointer remembers, picked up again by this tab. */
function resumedFrom(pointer: BillingOperationPointer): ResumedAttempt {
  return {
    presentation: pointer.presentation,
    attemptStartedAt: pointer.attemptStartedAt,
    resumed: true,
    awaitedHere: pointer.awaited === true,
    ...(pointer.redirect === undefined
      ? {}
      : { returnedFrom: pointer.redirect })
  }
}

interface ServerPendingOperation {
  readonly id: string
  readonly kind: BillingOperationKind
  readonly actionUrl?: string
  readonly clientSecret?: string
}

function continuationOf(issued: {
  readonly actionUrl?: string | undefined
  readonly clientSecret?: string | undefined
}): Pick<AdoptInput, 'actionUrl' | 'clientSecret'> {
  return {
    ...(issued.actionUrl === undefined ? {} : { actionUrl: issued.actionUrl }),
    ...(issued.clientSecret === undefined
      ? {}
      : { clientSecret: issued.clientSecret })
  }
}

function pendingFromStatus(
  status: BillingStatusData
): ServerPendingOperation | undefined {
  if (status.pending_billing_op_id === undefined) return undefined
  return {
    id: status.pending_billing_op_id,
    kind: status.pending_billing_op_type === 'topup' ? 'topup' : 'subscription',
    ...continuationOf({
      actionUrl: status.action_url,
      clientSecret: status.payment_intent_client_secret
    })
  }
}

function initialPendingState(
  input: AdoptInput,
  observedAt: number,
  presentation: BillingPresentationState
): PendingBillingOperation {
  const actionUrl = validateActionUrl(input.actionUrl)
  const challenge =
    input.clientSecret === undefined || input.presentation !== 'embedded'
      ? undefined
      : { clientSecret: input.clientSecret, status: 'required' as const }
  return {
    id: input.id,
    kind: input.kind,
    scope: input.context.scope,
    ...presentation,
    observedAt,
    attemptStartedAt: input.attemptStartedAt,
    ...(input.awaitedHere ? { awaitedHere: true } : {}),
    phase: 'pending',
    ...(actionUrl === undefined ? {} : { actionUrl }),
    ...(challenge === undefined ? {} : { challenge }),
    customerActionSeen:
      actionUrl !== undefined || input.clientSecret !== undefined
  }
}

function failureCategoryFor(
  state: Exclude<BillingOperationState, PendingBillingOperation>
): BillingOperationFailureCategory | undefined {
  switch (state.phase) {
    case 'succeeded':
      return undefined
    case 'failed':
      return state.kind === 'cancel' ? 'api_rejected' : 'provider_decline'
    case 'timed_out':
      return 'poll_timeout'
    case 'reconciliation_needed':
      return 'reconciliation_needed'
    case 'superseded':
      return 'stale_operation'
  }
}

const FRICTION_EVENT_NAME = {
  challenge_required:
    BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT.challengeRequired,
  challenge_completed:
    BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT.challengeCompleted,
  challenge_failed: BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT.challengeFailed
} as const satisfies Record<PaymentFrictionSignal['stage'], string>

/** What the hosted page asks of the customer, from what the server waits on. */
function hostedStepOf(state: PendingBillingOperation): CheckoutHostedStep {
  if (
    state.authenticationState === 'requires_action' ||
    (state.presentation === 'embedded' && state.challenge !== undefined)
  ) {
    return 'authentication'
  }
  if (state.serverPhase === 'awaiting_payment_method') return 'payment_method'
  if (state.serverPhase === 'awaiting_invoice_payment') return 'invoice_payment'
  return 'checkout'
}

/** The pause is this tab's own challenge on screen; a hosted page never pauses. */
function isDrivingChallenge(state: PendingBillingOperation): boolean {
  return (
    state.presentation === 'embedded' &&
    state.challenge?.status === 'in_progress'
  )
}

export function createBillingOperationLifecycle(
  options: BillingOperationLifecycleOptions
): BillingOperationLifecycle {
  const {
    transport,
    scopeSource,
    statusReader,
    embeddedCheckoutAvailable = () => false,
    hostedDestination = () => 'stripe',
    onTelemetry,
    now = Date.now
  } = options
  const pointers: OperationPointerStore =
    options.pointerStorage === undefined
      ? NO_POINTER_STORE
      : createOperationPointerStore(options.pointerStorage, now, {
          retainSettled: options.retainSettledPointer === true
        })

  const operations = new Map<string, OperationRecord>()
  const inFlightCommands = new Map<BillingOperationKind, InFlightCommand>()
  const listeners = new Set<(state: BillingOperationState) => void>()
  const lifetime = { disposed: false }

  // Role is part of the scope, so a demotion mid-payment supersedes the
  // operation and this tab stops observing it. The pointer key omits role on
  // purpose: the charge still belongs to (user, workspace), so `recover` finds
  // it again under the new role. Keying the pointer by role would strand it.
  const scopeTracker = createBillingScopeTracker(scopeSource, () => {
    for (const record of operations.values()) {
      dispatch(record, { type: 'superseded' })
    }
  })

  function isLive(context: BillingScopeContext): boolean {
    return !lifetime.disposed && scopeTracker.isCurrent(context)
  }

  function publish(record: OperationRecord) {
    for (const listener of Array.from(listeners)) listener(record.state)
  }

  function stopTimer(record: OperationRecord) {
    if (record.timer === undefined) return
    clearTimeout(record.timer)
    record.timer = undefined
  }

  function emitTerminalTelemetry(record: OperationRecord) {
    const state = record.state
    if (!isTerminal(state)) return
    const category = failureCategoryFor(state)
    onTelemetry?.({
      name:
        state.phase === 'succeeded'
          ? BILLING_OPERATION_TELEMETRY_EVENT.succeeded
          : state.phase === 'timed_out'
            ? BILLING_OPERATION_TELEMETRY_EVENT.timeout
            : BILLING_OPERATION_TELEMETRY_EVENT.failed,
      billing_op_id: state.id,
      operation_type: state.kind,
      presentation: state.presentation,
      resumed: record.resumed,
      ...(category === undefined ? {} : { failure_category: category }),
      ...(state.phase === 'failed'
        ? { decline_reason: state.declineReason }
        : {}),
      duration_ms: now() - state.attemptStartedAt
    })
  }

  function emitFrictionTelemetry(
    record: OperationRecord,
    before: BillingOperationState | undefined
  ) {
    const state = record.state
    for (const signal of paymentFrictionBetween(before, state)) {
      onTelemetry?.({
        name: FRICTION_EVENT_NAME[signal.stage],
        billing_op_id: state.id,
        operation_type: state.kind,
        presentation: state.presentation,
        resumed: record.resumed,
        ...('declineReason' in signal && signal.declineReason !== undefined
          ? { decline_reason: signal.declineReason }
          : {})
      })
    }
  }

  function dispatch(record: OperationRecord, event: BillingOperationEvent) {
    const before = record.state
    const next = reduceBillingOperation(before, event)
    if (next === before) return
    record.state = next
    emitFrictionTelemetry(record, before)
    if (isTerminal(next)) {
      stopTimer(record)
      pointers.settle(next)
      emitTerminalTelemetry(record)
      record.resolveSettled(next)
    }
    publish(record)
  }

  function schedule(record: OperationRecord) {
    if (record.state.phase !== 'pending') return
    stopTimer(record)
    record.waitingWithoutActionSince = isWaitingOnCustomerWithoutAction(
      record.state
    )
      ? (record.waitingWithoutActionSince ?? now())
      : undefined
    const delayMs = nextPollDelayMs(
      record.state,
      record.delayMs,
      record.waitingWithoutActionSince === undefined
        ? 0
        : now() - record.waitingWithoutActionSince
    )
    record.delayMs = delayMs
    record.timer = setTimeout(() => void poll(record), delayMs)
  }

  // One request per record at a time: a wake arriving mid-poll joins the
  // poll in flight instead of doubling the request rate. The request is
  // bound to the record, not the id, so an id re-adopted after supersession
  // starts its own observation instead of joining a poll that can no longer
  // schedule it.
  function poll(record: OperationRecord): Promise<void> {
    if (record.inFlightPoll !== undefined) return record.inFlightPoll
    const request = pollOnce(record).finally(() => {
      record.inFlightPoll = undefined
    })
    record.inFlightPoll = request
    return request
  }

  function writePointer(
    scope: BillingScope,
    state: BillingOperationState,
    redirect?: BillingOperationPointer['redirect']
  ) {
    pointers.write(scope, {
      operationId: state.id,
      kind: state.kind,
      presentation: state.presentation,
      attemptStartedAt: state.attemptStartedAt,
      ...(state.awaitedHere ? { awaited: true } : {}),
      ...(redirect === undefined ? {} : { redirect })
    })
  }

  function emitHostedStepTelemetry(
    record: OperationRecord,
    name: HostedStepEventName,
    visit: HostedStepVisit
  ) {
    onTelemetry?.({
      name,
      billing_op_id: record.state.id,
      operation_type: record.state.kind,
      presentation: record.state.presentation,
      resumed: record.resumed,
      ...visit
    })
  }

  function readOperation(operationId: string) {
    return readValidatedBillingResponse(
      transport,
      { method: 'GET', route: operationRoute(operationId) },
      (body) => BillingOpStatusSchema.safeParse(body)
    )
  }

  function continueOrExpire(record: OperationRecord) {
    if (record.state.phase !== 'pending') return
    if (hasExhaustedPollBudget(record.state, now())) {
      dispatch(record, { type: 'timed_out' })
      return
    }
    schedule(record)
  }

  async function pollOnce(record: OperationRecord) {
    const state = record.state
    if (state.phase !== 'pending') return
    stopTimer(record)
    if (isDrivingChallenge(state)) return
    if (!scopeTracker.isCurrent(record.context)) {
      dispatch(record, { type: 'superseded' })
      return
    }
    if (hasExhaustedPollBudget(state, now())) {
      dispatch(record, { type: 'timed_out' })
      return
    }

    const response = await readOperation(state.id)

    if (record.state.phase !== 'pending') return
    if (!isLive(record.context)) {
      dispatch(record, { type: 'superseded' })
      return
    }
    applyPollResponse(record, response)
  }

  function applyPollResponse(
    record: OperationRecord,
    response: Awaited<ReturnType<typeof readOperation>>
  ) {
    if (response.status === 'ok') {
      dispatch(record, { type: 'status_polled', status: response.value.data })
      continueOrExpire(record)
      return
    }
    if (
      response.code === 'SUPERSEDED' ||
      response.code === 'ACCESS_DENIED' ||
      response.code === 'NOT_AUTHENTICATED'
    ) {
      dispatch(record, { type: 'superseded' })
    } else if (response.code === 'NOT_FOUND') {
      dispatch(record, { type: 'lost' })
    } else {
      continueOrExpire(record)
    }
  }

  /** Read at every adoption, so an operation recovered from the pointer lands on today's destination. */
  function destinationFor(
    presentation: BillingPresentation
  ): BillingPresentationState {
    return presentation === 'hosted'
      ? { presentation, hostedDestination: hostedDestination() }
      : { presentation }
  }

  /**
   * An id is observed afresh once this tab has stopped learning anything new
   * about it: its poll budget ran out or it left the scope. One the server
   * parked for reconciliation, or a success whose credits were still landing,
   * is observed afresh only for a caller reading settled operations, since
   * the server may since have settled it or recorded the grant.
   */
  function adopt(input: AdoptInput, includeSettled = false): OperationRecord {
    const existing = operations.get(input.id)
    if (
      existing !== undefined &&
      existing.state.phase !== 'timed_out' &&
      existing.state.phase !== 'superseded' &&
      !(includeSettled && isStillSettling(existing.state))
    ) {
      return existing
    }

    const state = initialPendingState(
      input,
      now(),
      destinationFor(input.presentation)
    )

    let resolveSettled: (state: BillingOperationState) => void = () => {}
    const settled = new Promise<BillingOperationState>((resolve) => {
      resolveSettled = resolve
    })
    const record: OperationRecord = {
      state,
      context: input.context,
      resumed: input.resumed,
      delayMs: undefined,
      waitingWithoutActionSince: undefined,
      timer: undefined,
      inFlightPoll: undefined,
      awaitingReturn: undefined,
      settled,
      resolveSettled
    }
    operations.set(input.id, record)
    writePointer(input.context.scope, state)
    onTelemetry?.({
      name: BILLING_OPERATION_TELEMETRY_EVENT.started,
      billing_op_id: input.id,
      operation_type: input.kind,
      presentation: input.presentation,
      resumed: input.resumed
    })
    emitFrictionTelemetry(record, undefined)
    if (input.returnedFrom !== undefined) {
      emitHostedStepTelemetry(
        record,
        BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT.returned,
        {
          ...input.returnedFrom,
          navigation: 'redirect'
        }
      )
    }
    startObserving(record, input, state)
    return record
  }

  // A resumed operation without a served link is announced by its first
  // status, never before it: the status read names it but not what it waits
  // on, and a checkout parked on a card must not be announced as processing
  // for the length of a poll. A served link already says what it waits on.
  function startObserving(
    record: OperationRecord,
    input: AdoptInput,
    state: PendingBillingOperation
  ) {
    if (input.initialStatus !== undefined) {
      dispatch(record, { type: 'status_polled', status: input.initialStatus })
      continueOrExpire(record)
      return
    }
    if (!input.resumed || state.actionUrl !== undefined) publish(record)
    void poll(record)
  }

  function routeFor(
    rail: BillingStatusData['billing_rail'],
    issued: { readonly actionUrl?: string; readonly clientSecret?: string }
  ): BillingPresentation {
    return selectBillingPresentation({
      embeddedCheckoutAvailable: embeddedCheckoutAvailable(),
      billingRail: rail,
      ...(issued.actionUrl === undefined
        ? {}
        : { hostedUrl: issued.actionUrl }),
      ...(issued.clientSecret === undefined
        ? {}
        : { clientSecret: issued.clientSecret })
    })
  }

  async function beginOnce(
    kind: BillingOperationKind,
    context: BillingScopeContext,
    issue: (
      scope: BillingScope
    ) => Promise<BillingResult<IssuedBillingOperation>>
  ): Promise<BillingResult<BillingOperationState>> {
    // The backend's word on what is already pending comes first: a second
    // charge attempt is never issued over one the server is still settling.
    const status = await statusReader.read()
    // A scope change outranks a failed read, as in recover().
    if (!isLive(context)) return SUPERSEDED
    if (status.status === 'error') return status

    const rail = status.value.status.billing_rail
    const parked = await resubmitTarget(
      pendingFromStatus(status.value.status),
      kind
    )
    if (!isLive(context)) return SUPERSEDED
    if (parked === 'refused') return OPERATION_ALREADY_PENDING

    const attemptStartedAt = now()
    const issued = await issue(context.scope)
    if (!isLive(context)) {
      return leftScope(context, kind, rail, issued, attemptStartedAt)
    }
    if (issued.status === 'error') return issued

    const resumed =
      parked === undefined ? undefined : resumeParked(parked, issued.value)
    if (resumed !== undefined) return { status: 'ok', value: resumed }

    const record = adopt({
      id: issued.value.operationId,
      kind,
      context,
      presentation: routeFor(rail, issued.value),
      ...continuationOf(issued.value),
      attemptStartedAt,
      resumed: false,
      awaitedHere: true
    })
    return { status: 'ok', value: record.state }
  }

  // The operation exists server-side under the scope this tab just left; the
  // pointer waits there so a return recovers it rather than reissuing.
  function leftScope(
    context: BillingScopeContext,
    kind: BillingOperationKind,
    rail: BillingStatusData['billing_rail'],
    issued: BillingResult<IssuedBillingOperation>,
    attemptStartedAt: number
  ): typeof SUPERSEDED {
    if (issued.status === 'ok') {
      pointers.write(context.scope, {
        operationId: issued.value.operationId,
        kind,
        presentation: routeFor(rail, issued.value),
        attemptStartedAt,
        awaited: true
      })
    }
    return SUPERSEDED
  }

  /**
   * Declines rather than joins an operation of this kind the server already
   * has pending, because the status names no plan: this caller asked for one
   * outcome and the parked attempt settles another, so reporting that one as
   * this command's result would tell the customer they bought something they
   * did not choose. recover() is where a deliberate return to it belongs.
   *
   * The exception is a checkout this tab watches parked on a card. The server
   * keeps no link back to it, and a resubmit is how it resumes that checkout
   * or replaces it, so the command goes through with that record in hand.
   */
  async function resubmitTarget(
    pending: ServerPendingOperation | undefined,
    kind: BillingOperationKind
  ): Promise<OperationRecord | 'refused' | undefined> {
    if (pending?.kind !== kind) return undefined
    const record = operations.get(pending.id)
    if (
      record?.state.phase === 'pending' &&
      record.state.serverPhase === undefined
    ) {
      const read = await readOperation(pending.id)
      if (read.status === 'ok') {
        dispatch(record, { type: 'status_polled', status: read.value.data })
      }
    }
    return record?.state.phase === 'pending' &&
      record.state.serverPhase === 'awaiting_payment_method'
      ? record
      : 'refused'
  }

  /**
   * The same id is the parked checkout resumed, with the fresh hosted step the
   * server minted for it; another id replaced it, so this tab stops watching.
   */
  function resumeParked(
    parked: OperationRecord,
    issued: IssuedBillingOperation
  ): BillingOperationState | undefined {
    if (parked.state.id !== issued.operationId) {
      dispatch(parked, { type: 'superseded' })
      return undefined
    }
    if (issued.actionUrl !== undefined) {
      dispatch(parked, { type: 'action_reissued', actionUrl: issued.actionUrl })
    }
    return parked.state
  }

  function begin(
    kind: BillingOperationKind,
    issue: (
      scope: BillingScope
    ) => Promise<BillingResult<IssuedBillingOperation>>
  ): Promise<BillingResult<BillingOperationState>> {
    if (lifetime.disposed) return Promise.resolve(SUPERSEDED)
    const context = scopeTracker.capture()
    if (context === undefined) return Promise.resolve(NOT_AUTHENTICATED)

    // Single-flight holds only within a scope: an attempt the scope change
    // already doomed to SUPERSEDED must not stand in for this caller's.
    const inFlight = inFlightCommands.get(kind)
    if (inFlight !== undefined && isLive(inFlight.context)) {
      return inFlight.promise
    }
    const attempt = beginOnce(kind, context, issue).finally(() => {
      if (inFlightCommands.get(kind)?.promise === attempt) {
        inFlightCommands.delete(kind)
      }
    })
    inFlightCommands.set(kind, { context, promise: attempt })
    return attempt
  }

  function fromPointer(
    pointer: BillingOperationPointer,
    context: BillingScopeContext
  ): AdoptInput {
    return {
      id: pointer.operationId,
      kind: pointer.kind,
      context,
      ...resumedFrom(pointer)
    }
  }

  // Unreachable is not "nothing pending": the pointer is the only evidence
  // left, and observing it costs a poll while reissuing could cost a charge.
  function recoverFromPointer(
    failure: BillingFailure,
    pointer: BillingOperationPointer | undefined,
    context: BillingScopeContext,
    includeSettled: boolean
  ): BillingResult<BillingOperationState | undefined> {
    if (failure.code !== 'REQUEST_FAILED' || pointer === undefined) {
      return failure
    }
    const record = adopt(fromPointer(pointer, context), includeSettled)
    return { status: 'ok', value: record.state }
  }

  function resumeServerPending(
    pending: ServerPendingOperation,
    rail: BillingStatusData['billing_rail'],
    pointer: BillingOperationPointer | undefined,
    context: BillingScopeContext,
    includeSettled: boolean
  ): BillingResult<BillingOperationState> {
    const known = pointer?.operationId === pending.id ? pointer : undefined
    const record = adopt(
      {
        ...pending,
        context,
        ...(known === undefined
          ? {
              presentation: routeFor(rail, pending),
              attemptStartedAt: now(),
              resumed: true,
              awaitedHere: false
            }
          : resumedFrom(known))
      },
      includeSettled
    )
    return { status: 'ok', value: record.state }
  }

  // The server reports nothing pending, so the pointed-at operation has
  // either settled since this tab last saw it or never belonged to this
  // scope. One read decides which; a stale pointer is dropped, never
  // re-observed on a schedule.
  async function probePointer(
    pointer: BillingOperationPointer,
    context: BillingScopeContext,
    includeSettled: boolean
  ): Promise<BillingResult<BillingOperationState | undefined>> {
    const probe = await readOperation(pointer.operationId)
    if (!isLive(context)) return SUPERSEDED
    if (probe.status === 'error') {
      if (probe.code !== 'NOT_FOUND') return probe
      pointers.clear(context.scope, pointer.operationId)
      return { status: 'ok', value: undefined }
    }
    const record = adopt(
      { ...fromPointer(pointer, context), initialStatus: probe.value.data },
      includeSettled
    )
    return { status: 'ok', value: record.state }
  }

  /** A settled pointer answers only a caller that asked for it. */
  function readPointer(
    scope: BillingScope,
    includeSettled: boolean
  ): BillingOperationPointer | undefined {
    const pointer = pointers.read(scope)
    return pointer?.settled === undefined || includeSettled
      ? pointer
      : undefined
  }

  async function recover({
    includeSettled = false
  }: BillingRecoverOptions = {}): Promise<
    BillingResult<BillingOperationState | undefined>
  > {
    if (lifetime.disposed) return SUPERSEDED
    const context = scopeTracker.capture()
    if (context === undefined) return NOT_AUTHENTICATED

    const status = await statusReader.read()
    if (!isLive(context)) return SUPERSEDED
    const pointer = readPointer(context.scope, includeSettled)
    if (status.status === 'error') {
      return recoverFromPointer(status, pointer, context, includeSettled)
    }

    const pending = pendingFromStatus(status.value.status)
    if (pending !== undefined) {
      return resumeServerPending(
        pending,
        status.value.status.billing_rail,
        pointer,
        context,
        includeSettled
      )
    }
    if (pointer === undefined) return { status: 'ok', value: undefined }
    return probePointer(pointer, context, includeSettled)
  }

  function wake() {
    for (const record of operations.values()) {
      reportReturnFromNewTab(record)
      if (record.state.phase !== 'pending') continue
      if (isDrivingChallenge(record.state)) continue
      void poll(record)
    }
  }

  function refusedSwitch(
    state: PendingBillingOperation,
    presentation: BillingPresentation
  ): PresentationSwitchOutcome | undefined {
    if (state.presentation === presentation) return 'unchanged'
    if (presentation === 'hosted') {
      return state.actionUrl === undefined ? 'no_hosted_url' : undefined
    }
    return !embeddedCheckoutAvailable() || state.challenge === undefined
      ? 'embedded_unavailable'
      : undefined
  }

  function switchEvent(
    presentation: BillingPresentation
  ): BillingOperationEvent {
    return presentation === 'hosted'
      ? {
          type: 'presentation_switched',
          presentation,
          hostedDestination: hostedDestination()
        }
      : { type: 'presentation_switched', presentation }
  }

  function switchPresentation(
    operationId: string,
    presentation: BillingPresentation
  ): PresentationSwitchOutcome {
    const record = operations.get(operationId)
    if (record === undefined) return 'unknown_operation'
    const state = record.state
    if (state.phase !== 'pending') return 'not_pending'
    const refusal = refusedSwitch(state, presentation)
    if (refusal !== undefined) return refusal
    dispatch(record, switchEvent(presentation))
    writePointer(record.context.scope, record.state)
    record.delayMs = undefined
    schedule(record)
    return 'switched'
  }

  function reportReturnFromNewTab(record: OperationRecord) {
    const visit = record.awaitingReturn
    if (visit === undefined) return
    record.awaitingReturn = undefined
    emitHostedStepTelemetry(
      record,
      BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT.returned,
      visit
    )
  }

  function reportHostedStepOpened(
    operationId: string,
    navigation: CheckoutRedirectNavigation,
    methodKind?: CheckoutMethodKind
  ) {
    const record = operations.get(operationId)
    if (record === undefined || record.state.phase !== 'pending') return
    const state = record.state
    const redirect = {
      destination:
        state.presentation === 'hosted' ? state.hostedDestination : 'stripe',
      step: hostedStepOf(state),
      ...(methodKind === undefined ? {} : { method_kind: methodKind })
    } as const
    const visit = { ...redirect, navigation }
    if (navigation === 'redirect') {
      writePointer(record.context.scope, state, redirect)
    } else {
      record.awaitingReturn = visit
    }
    emitHostedStepTelemetry(
      record,
      BILLING_CHECKOUT_FRICTION_TELEMETRY_EVENT.redirectStarted,
      visit
    )
  }

  function reportChallengeStarted(operationId: string) {
    const record = operations.get(operationId)
    if (record === undefined) return
    dispatch(record, { type: 'challenge_started' })
    if (record.state.phase === 'pending' && isDrivingChallenge(record.state)) {
      stopTimer(record)
    }
  }

  function reportChallengeSettled(
    operationId: string,
    outcome: 'completed' | 'failed'
  ) {
    const record = operations.get(operationId)
    if (record === undefined || record.state.phase !== 'pending') return
    dispatch(record, { type: 'challenge_settled', outcome })
    record.delayMs = undefined
    // A completed challenge is read back at once; a failed one is not a
    // verdict on the payment — the server may have seen it succeed — so the
    // operation stays observed on the parked cadence rather than stopping.
    if (outcome === 'completed') void poll(record)
    else schedule(record)
  }

  return {
    begin,
    recover,
    wake,
    switchPresentation,
    reportHostedStepOpened,
    reportChallengeStarted,
    reportChallengeSettled,
    get: (operationId) => operations.get(operationId)?.state,
    getSnapshot: () => [...operations.values()].map((record) => record.state),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    settled: (operationId) => operations.get(operationId)?.settled,
    dispose: () => {
      lifetime.disposed = true
      // Every pending settlement resolves so no awaiting host hangs; this is
      // the tab giving up observation, not an outcome, so no telemetry.
      for (const record of operations.values()) {
        stopTimer(record)
        const next = reduceBillingOperation(record.state, {
          type: 'superseded'
        })
        if (next === record.state) continue
        record.state = next
        record.resolveSettled(next)
      }
      operations.clear()
      inFlightCommands.clear()
      listeners.clear()
      scopeTracker.dispose()
    }
  }
}
