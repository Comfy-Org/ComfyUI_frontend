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
import { zBillingOpStatusResponse } from '@comfyorg/ingest-types/zod'

import { BILLING_OPERATION_TELEMETRY_EVENT } from '../../telemetry.js'
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
  isTerminal,
  reduceBillingOperation,
  validateActionUrl
} from './operationState.js'
import { selectBillingPresentation } from './presentation.js'
import { readValidatedBillingResponse } from './sharedRead.js'
import type { BillingStatusData, BillingStatusReader } from './status.js'

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

export interface BillingOperationTelemetryEvent {
  readonly name: (typeof BILLING_OPERATION_TELEMETRY_EVENT)[keyof typeof BILLING_OPERATION_TELEMETRY_EVENT]
  readonly billing_op_id: string
  readonly operation_type: BillingOperationKind
  readonly presentation: BillingPresentation
  /** True when this tab reattached to an operation it did not issue. */
  readonly resumed: boolean
  readonly failure_category?: BillingOperationFailureCategory
  readonly decline_reason?: BillingDeclineReason
  /** From the attempt's start, so a resumed operation reports its whole life. */
  readonly duration_ms?: number
}

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
  /** Whether the host can drive an in-page challenge right now. Absent routes everything hosted. */
  readonly embeddedCheckoutAvailable?: () => boolean
  /** Which origin serves a hosted page right now. Absent keeps every hosted operation on the provider page. */
  readonly hostedDestination?: () => HostedBillingDestination
  readonly onTelemetry?: (event: BillingOperationTelemetryEvent) => void
  readonly now?: () => number
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
  recover: () => Promise<BillingResult<BillingOperationState | undefined>>
  /** The host became visible or focused: poll every pending operation now. */
  wake: () => void
  /** Moves the operation between presentations under the same id. */
  switchPresentation: (
    operationId: string,
    presentation: BillingPresentation
  ) => PresentationSwitchOutcome
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
  /** A status already read for this operation; observed from it instead of polled again. */
  readonly initialStatus?: BillingOpStatus
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
      : createOperationPointerStore(options.pointerStorage, now)

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

  function dispatch(record: OperationRecord, event: BillingOperationEvent) {
    const next = reduceBillingOperation(record.state, event)
    if (next === record.state) return
    record.state = next
    if (isTerminal(next)) {
      stopTimer(record)
      pointers.clearIfTerminal(next)
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

  function writePointer(scope: BillingScope, state: BillingOperationState) {
    pointers.write(scope, {
      operationId: state.id,
      kind: state.kind,
      presentation: state.presentation,
      attemptStartedAt: state.attemptStartedAt
    })
  }

  function readOperation(operationId: string) {
    return readValidatedBillingResponse(
      transport,
      { method: 'GET', route: operationRoute(operationId) },
      (body) => zBillingOpStatusResponse.safeParse(body)
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

  function adopt(input: AdoptInput): OperationRecord {
    const existing = operations.get(input.id)
    if (
      existing !== undefined &&
      existing.state.phase !== 'timed_out' &&
      existing.state.phase !== 'superseded'
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
    publish(record)

    if (input.initialStatus === undefined) {
      void poll(record)
    } else {
      dispatch(record, { type: 'status_polled', status: input.initialStatus })
      continueOrExpire(record)
    }
    return record
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
    const pending = pendingFromStatus(status.value.status)
    // Declining, rather than joining it, because the status names no plan:
    // this caller asked for one outcome and the parked attempt settles
    // another, so reporting that one as this command's result would tell the
    // customer they bought something they did not choose. recover() is where
    // a deliberate return to the parked operation belongs.
    if (pending !== undefined && pending.kind === kind) {
      return OPERATION_ALREADY_PENDING
    }

    const attemptStartedAt = now()
    const issued = await issue(context.scope)
    if (!isLive(context)) {
      // The operation exists server-side under the scope this tab just left;
      // the pointer waits there so a return recovers it rather than reissuing.
      if (issued.status === 'ok') {
        pointers.write(context.scope, {
          operationId: issued.value.operationId,
          kind,
          presentation: routeFor(rail, issued.value),
          attemptStartedAt
        })
      }
      return SUPERSEDED
    }
    if (issued.status === 'error') return issued

    const record = adopt({
      id: issued.value.operationId,
      kind,
      context,
      presentation: routeFor(rail, issued.value),
      ...continuationOf(issued.value),
      attemptStartedAt,
      resumed: false
    })
    return { status: 'ok', value: record.state }
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

  // Unreachable is not "nothing pending": the pointer is the only evidence
  // left, and observing it costs a poll while reissuing could cost a charge.
  function recoverFromPointer(
    failure: BillingFailure,
    pointer: BillingOperationPointer | undefined,
    context: BillingScopeContext
  ): BillingResult<BillingOperationState | undefined> {
    if (failure.code !== 'REQUEST_FAILED' || pointer === undefined) {
      return failure
    }
    const record = adopt({
      id: pointer.operationId,
      kind: pointer.kind,
      context,
      presentation: pointer.presentation,
      attemptStartedAt: pointer.attemptStartedAt,
      resumed: true
    })
    return { status: 'ok', value: record.state }
  }

  function resumeServerPending(
    pending: ServerPendingOperation,
    rail: BillingStatusData['billing_rail'],
    pointer: BillingOperationPointer | undefined,
    context: BillingScopeContext
  ): BillingResult<BillingOperationState> {
    const known = pointer?.operationId === pending.id ? pointer : undefined
    const record = adopt({
      ...pending,
      context,
      presentation: known?.presentation ?? routeFor(rail, pending),
      attemptStartedAt: known?.attemptStartedAt ?? now(),
      resumed: true
    })
    return { status: 'ok', value: record.state }
  }

  // The server reports nothing pending, so the pointed-at operation has
  // either settled since this tab last saw it or never belonged to this
  // scope. One read decides which; a stale pointer is dropped, never
  // re-observed on a schedule.
  async function probePointer(
    pointer: BillingOperationPointer,
    context: BillingScopeContext
  ): Promise<BillingResult<BillingOperationState | undefined>> {
    const probe = await readOperation(pointer.operationId)
    if (!isLive(context)) return SUPERSEDED
    if (probe.status === 'error') {
      if (probe.code !== 'NOT_FOUND') return probe
      pointers.clear(context.scope, pointer.operationId)
      return { status: 'ok', value: undefined }
    }
    const record = adopt({
      id: pointer.operationId,
      kind: pointer.kind,
      context,
      presentation: pointer.presentation,
      attemptStartedAt: pointer.attemptStartedAt,
      resumed: true,
      initialStatus: probe.value.data
    })
    return { status: 'ok', value: record.state }
  }

  async function recover(): Promise<
    BillingResult<BillingOperationState | undefined>
  > {
    if (lifetime.disposed) return SUPERSEDED
    const context = scopeTracker.capture()
    if (context === undefined) return NOT_AUTHENTICATED

    const status = await statusReader.read()
    if (!isLive(context)) return SUPERSEDED
    const pointer = pointers.read(context.scope)
    if (status.status === 'error') {
      return recoverFromPointer(status, pointer, context)
    }

    const pending = pendingFromStatus(status.value.status)
    if (pending !== undefined) {
      return resumeServerPending(
        pending,
        status.value.status.billing_rail,
        pointer,
        context
      )
    }
    if (pointer === undefined) return { status: 'ok', value: undefined }
    return probePointer(pointer, context)
  }

  function wake() {
    for (const record of operations.values()) {
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
