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
const IN_FLIGHT_RETRIES = 5
const INTERRUPTION_RETRIES = 20
const UNREADABLE_RESULT_RETRIES = 2
const REQUEST_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

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

function runRequestId(state: QueuedRun): string | null {
  const active = state.phase === 'waiting' ? state.next : state
  return 'requestId' in active ? active.requestId : null
}

async function routerFetch(
  context: AttemptContext,
  url: string,
  init: { readonly method: 'GET' | 'POST' | 'PUT'; readonly body?: string }
): Promise<Response> {
  const { options } = context
  const token = (await options.freshToken?.()) ?? options.token
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
    signal: AbortSignal.any([
      context.signal,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    ])
  })
}

async function submit(
  state: Submitting,
  context: AttemptContext
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
  context: AttemptContext
): Promise<QueuedRun> {
  const response = await routerFetch(
    context,
    requestsUrl(context, state.requestId),
    { method: 'GET' }
  )
  if (response.status === 202) {
    await response.body?.cancel().catch(() => {})
    return {
      phase: 'waiting',
      waitMs: pollDelayMs(response),
      next: { ...state, interruptions: 0 }
    }
  }
  if (
    (response.status === 429 || response.status === 503) &&
    state.interruptions < INTERRUPTION_RETRIES
  ) {
    await response.body?.cancel().catch(() => {})
    return {
      phase: 'waiting',
      waitMs: pollDelayMs(response),
      next: { ...state, interruptions: state.interruptions + 1 }
    }
  }
  const outputs = await settleRouterResponse(response, state.requestId, context)
  return { phase: 'complete', requestId: state.requestId, outputs }
}

function afterInterruption(
  error: unknown,
  state: ActiveRun,
  context: AttemptContext
): QueuedRun {
  context.options.signal.throwIfAborted()
  if (context.signal.aborted) throw error
  if (error instanceof WorkshopRouterError && error.reason !== 'network') {
    const unreadable =
      state.phase === 'collect' &&
      error.reason === 'response' &&
      state.unreadableResults < UNREADABLE_RESULT_RETRIES
    if (!unreadable) throw error
    return {
      phase: 'waiting',
      waitMs: POLL_DEFAULT_MS,
      next: { ...state, unreadableResults: state.unreadableResults + 1 }
    }
  }
  if (state.interruptions >= INTERRUPTION_RETRIES)
    throw new WorkshopRouterError(
      'network',
      runRequestId(state),
      {},
      undefined,
      'request',
      { cause: error }
    )
  return {
    phase: 'waiting',
    waitMs: interruptionDelayMs(state.interruptions),
    next: { ...state, interruptions: state.interruptions + 1 }
  }
}

async function advance(
  state: PendingRun,
  context: AttemptContext
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

function requestCancellation(context: AttemptContext, requestId: string): void {
  void fetch(`${requestsUrl(context, requestId)}/cancel`, {
    method: 'PUT',
    credentials: 'omit',
    redirect: 'error',
    keepalive: true,
    headers: { Authorization: `Bearer ${context.options.token}` }
  }).catch(() => {})
}

export async function runWorkshopRouter(
  options: RouterRunOptions
): Promise<RouterRunResult> {
  const context = createAttemptContext(options)
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
  } catch (error) {
    const requestId = runRequestId(state)
    if (options.signal.aborted && requestId)
      requestCancellation(context, requestId)
    options.signal.throwIfAborted()
    if (error instanceof WorkshopRouterError) throw error
    return throwRunFailure(error, context, requestId)
  }
  if (state.phase === 'synchronous')
    return runSynchronousWorkshopRouter(options, context)
  return {
    outputs: state.outputs,
    requestId: state.requestId,
    deadlineCollections: 0
  }
}
