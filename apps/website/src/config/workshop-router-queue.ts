import { combineAbortSignals, createTimeoutSignal } from '../utils/abortSignal'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import type {
  AttemptContext,
  RouterRunOptions,
  RouterRunResult
} from './workshop-router'
import {
  createAttemptContext,
  inFlightWaitMs,
  runSynchronousWorkshopRouter,
  settleRouterResponse,
  throwRunFailure,
  waitFor,
  withRunDeadline
} from './workshop-router'
import { WorkshopRouterError } from './workshop-router-errors'
import type { RunOutput } from './workshop-run'

const REQUEST_TIMEOUT_MS = 120_000
const POLL_DEFAULT_MS = 2_000
const POLL_MIN_MS = 1_000
const POLL_MAX_MS = 10_000
const MAX_TIMER_MS = 2_147_483_647
const IN_FLIGHT_RETRIES = 5
const INTERRUPTION_RETRIES = 20
const UNREADABLE_RESULT_RETRIES = 2
const REQUEST_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
const TERMINAL_RESULT_ERRORS = new Set([
  'invalid_input',
  'content_policy_violation',
  'provider_error',
  'provider_timeout',
  'insufficient_credits',
  'internal_error',
  'cancelled',
  'queue_timeout'
])

interface QueueContext extends AttemptContext {
  latestToken: string
}

interface Submitting {
  readonly phase: 'submit'
  readonly inFlightRetries: number
  readonly interruptions: number
}
interface Collecting {
  readonly phase: 'collect'
  readonly requestId: string
  readonly interruptions: number
  readonly unreadableResults: number
}
type ActiveRun = Submitting | Collecting
interface Waiting {
  readonly phase: 'waiting'
  readonly waitMs: number
  readonly next: ActiveRun
}
type PendingRun = ActiveRun | Waiting
type QueuedRun =
  | PendingRun
  | { readonly phase: 'synchronous' }
  | {
      readonly phase: 'complete'
      readonly requestId: string
      readonly outputs: RunOutput[]
    }

function requestsUrl(context: AttemptContext, requestId?: string): string {
  const root = `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${context.options.contract.id}/requests`
  return requestId ? `${root}/${requestId}` : root
}

function queuedRequestId(handle: unknown): string | undefined {
  if (typeof handle !== 'object' || handle === null) return
  if (!('request_id' in handle)) return
  const id = handle.request_id
  return typeof id === 'string' && REQUEST_ID.test(id) ? id : undefined
}

function pollDelayMs(response: Response): number {
  const seconds = Number(response.headers.get('Retry-After')?.trim() || NaN)
  if (!Number.isFinite(seconds)) return POLL_DEFAULT_MS
  return Math.min(Math.max(seconds * 1000, POLL_MIN_MS), POLL_MAX_MS)
}

function interruptionDelayMs(interruptions: number): number {
  return Math.min(POLL_DEFAULT_MS * 2 ** interruptions, POLL_MAX_MS)
}

function interruptedRequestDelayMs(
  response: Response,
  interruptions: number
): number {
  const value = response.headers.get('Retry-After')?.trim()
  if (!value) return interruptionDelayMs(interruptions)
  const numericDelay = /^\d+$/.test(value) ? Number(value) * 1000 : NaN
  const dateDelay = Date.parse(value) - Date.now()
  if (Number.isFinite(numericDelay)) return Math.min(numericDelay, MAX_TIMER_MS)
  if (Number.isFinite(dateDelay) && dateDelay > 0)
    return Math.min(dateDelay, MAX_TIMER_MS)
  return interruptionDelayMs(interruptions)
}

function runRequestId(state: QueuedRun): string | null {
  const active = state.phase === 'waiting' ? state.next : state
  return 'requestId' in active ? active.requestId : null
}

async function routerFetch(
  context: QueueContext,
  url: string,
  init: { readonly method: 'GET' | 'POST' | 'PUT'; readonly body?: string }
): Promise<Response> {
  const { options } = context
  const token = (await options.freshToken?.()) ?? options.token
  context.signal.throwIfAborted()
  context.latestToken = token
  return fetch(url, {
    ...init,
    credentials: 'omit',
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body === undefined
        ? {}
        : {
            'Content-Type': 'application/json',
            'Idempotency-Key': options.idempotencyKey
          })
    },
    signal: combineAbortSignals([
      context.signal,
      createTimeoutSignal(REQUEST_TIMEOUT_MS)
    ])
  })
}

async function submit(
  state: Submitting,
  context: QueueContext
): Promise<QueuedRun> {
  const response = await routerFetch(context, requestsUrl(context), {
    method: 'POST',
    body: context.body
  })
  const callId = response.headers.get('X-Comfy-Request-Id')
  if (
    response.status === 403 &&
    response.headers.get('X-Comfy-Error-Type') === 'not_enabled'
  ) {
    await response.body?.cancel().catch(() => {})
    return { phase: 'synchronous' }
  }
  const waitMs = inFlightWaitMs(response)
  if (waitMs !== undefined && state.inFlightRetries < IN_FLIGHT_RETRIES) {
    await response.body?.cancel().catch(() => {})
    return {
      phase: 'waiting',
      waitMs,
      next: { ...state, inFlightRetries: state.inFlightRetries + 1 }
    }
  }
  if (!response.ok) {
    context.options.onRequestId?.(callId)
    await settleRouterResponse(response, callId, context)
  }
  const handle: unknown = await response.json().catch((error: unknown) => {
    if (error instanceof SyntaxError) return undefined
    throw error
  })
  const requestId = queuedRequestId(handle)
  if (!requestId)
    throw new WorkshopRouterError('response', callId, {}, undefined, 'response')
  context.options.onRequestId?.(requestId)
  return { phase: 'collect', requestId, interruptions: 0, unreadableResults: 0 }
}

async function collect(
  state: Collecting,
  context: QueueContext
): Promise<QueuedRun> {
  const response = await routerFetch(
    context,
    requestsUrl(context, state.requestId),
    { method: 'GET' }
  )
  const retry = await collectionRetry(response, state)
  if (retry) return retry
  return settleQueuedResult(response, state, context)
}

async function collectionRetry(
  response: Response,
  state: Collecting
): Promise<Waiting | undefined> {
  const pending = response.status === 202
  const interrupted = response.status === 429 || response.status === 503
  if (!pending && (!interrupted || state.interruptions >= INTERRUPTION_RETRIES))
    return
  await response.body?.cancel().catch(() => {})
  return {
    phase: 'waiting',
    waitMs: pending
      ? pollDelayMs(response)
      : interruptedRequestDelayMs(response, state.interruptions),
    next: {
      ...state,
      interruptions: pending ? 0 : state.interruptions + 1
    }
  }
}

async function settleQueuedResult(
  response: Response,
  state: Collecting,
  context: QueueContext
): Promise<QueuedRun> {
  try {
    const outputs = await settleRouterResponse(
      response,
      state.requestId,
      context
    )
    return { phase: 'complete', requestId: state.requestId, outputs }
  } catch (error) {
    if (!(error instanceof WorkshopRouterError)) throw error
    const errorType = error.response?.errorType
    throw new WorkshopRouterError(
      error.reason,
      error.requestId ?? state.requestId,
      error.fieldErrors,
      error.response,
      error.stage,
      {
        cause: error,
        requestSettlement:
          error.reason === 'policy' ||
          (errorType && TERMINAL_RESULT_ERRORS.has(errorType))
            ? 'terminal'
            : 'pending'
      }
    )
  }
}

function pendingCollectionFailure(
  failure: WorkshopRouterError,
  requestId: string
): WorkshopRouterError {
  return new WorkshopRouterError(
    failure.reason,
    failure.requestId ?? requestId,
    failure.fieldErrors,
    failure.response,
    failure.stage,
    { cause: failure, requestSettlement: 'pending' }
  )
}

function preserveCollectionSettlement(
  error: unknown,
  state: ActiveRun
): unknown {
  if (
    state.phase !== 'collect' ||
    !(error instanceof WorkshopRouterError) ||
    error.requestSettlement !== undefined
  )
    return error
  return pendingCollectionFailure(error, state.requestId)
}

function retryUnreadableResult(
  error: unknown,
  state: ActiveRun
): Waiting | undefined {
  if (!(error instanceof WorkshopRouterError) || error.reason === 'network')
    return
  if (error.requestSettlement === 'terminal') throw error
  if (
    state.phase !== 'collect' ||
    error.reason !== 'response' ||
    state.unreadableResults >= UNREADABLE_RESULT_RETRIES
  )
    throw error
  return {
    phase: 'waiting',
    waitMs: POLL_DEFAULT_MS,
    next: { ...state, unreadableResults: state.unreadableResults + 1 }
  }
}

function afterInterruption(
  error: unknown,
  state: ActiveRun,
  context: QueueContext
): QueuedRun {
  context.options.signal.throwIfAborted()
  if (context.signal.aborted) throw error
  const failure = preserveCollectionSettlement(error, state)
  const unreadable = retryUnreadableResult(failure, state)
  if (unreadable) return unreadable
  if (state.interruptions >= INTERRUPTION_RETRIES)
    throw new WorkshopRouterError(
      'network',
      runRequestId(state),
      {},
      undefined,
      'request',
      {
        cause: failure,
        ...(state.phase === 'collect'
          ? { requestSettlement: 'pending' as const }
          : {})
      }
    )
  return {
    phase: 'waiting',
    waitMs: interruptionDelayMs(state.interruptions),
    next: { ...state, interruptions: state.interruptions + 1 }
  }
}

async function advance(
  state: PendingRun,
  context: QueueContext
): Promise<QueuedRun> {
  if (state.phase === 'waiting') {
    await waitFor(state.waitMs, context.signal)
    return state.next
  }
  try {
    return state.phase === 'submit'
      ? await submit(state, context)
      : await collect(state, context)
  } catch (error) {
    return afterInterruption(error, state, context)
  }
}

function requestCancellation(context: QueueContext, requestId: string): void {
  void fetch(`${requestsUrl(context, requestId)}/cancel`, {
    method: 'PUT',
    credentials: 'omit',
    redirect: 'error',
    keepalive: true,
    headers: { Authorization: `Bearer ${context.latestToken}` }
  }).catch(() => {})
}

export async function runWorkshopRouter(
  options: RouterRunOptions
): Promise<RouterRunResult> {
  const context: QueueContext = {
    ...createAttemptContext(options),
    latestToken: options.token
  }
  let state: QueuedRun = {
    phase: 'submit',
    inFlightRetries: 0,
    interruptions: 0
  }
  try {
    while (state.phase !== 'complete' && state.phase !== 'synchronous') {
      const active: PendingRun = state
      state = await withRunDeadline(context, Number.POSITIVE_INFINITY, () =>
        advance(active, context)
      )
    }
    if (state.phase === 'synchronous')
      return await runSynchronousWorkshopRouter(options, context)
    return {
      outputs: state.outputs,
      requestId: state.requestId,
      deadlineCollections: 0
    }
  } catch (error) {
    const requestId = runRequestId(state)
    if (options.signal.aborted && requestId)
      requestCancellation(context, requestId)
    options.signal.throwIfAborted()
    if (error instanceof WorkshopRouterError) throw error
    return throwRunFailure(error, context, requestId)
  } finally {
    context.controller.abort()
  }
}
