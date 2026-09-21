import type { WorkshopContract } from './workshop-contract'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import { serializeRouterInput } from './workshop-request'
import { parseRouterResponse, releaseRouterOutputs } from './workshop-response'
import type { RunFailure, RunOutput } from './workshop-run'
import {
  WorkshopRouterError,
  workshopResponseDetails
} from './workshop-router-errors'
import { validateWorkshopInput } from './workshop-json-schema'
import type { WorkshopSvgRasterizer } from './workshop-svg-output'

const RUN_TIMEOUT_MS = 660_000
const TOTAL_RUN_TIMEOUT_MS = 2_700_000
const DEADLINE_COLLECTIONS = 3
const IN_FLIGHT_RETRIES = 5
const IN_FLIGHT_MAX_WAIT_MS = 10_000
const NETWORK_RECOVERIES = 1

function isParkedDeadline(response: Response): boolean {
  return (
    response.status === 504 &&
    response.headers.get('X-Comfy-Error-Type') === 'deadline_exceeded'
  )
}

export function inFlightWaitMs(response: Response): number | undefined {
  const retryAfter = response.headers.get('Retry-After')
  if (response.status !== 409 || !retryAfter?.trim()) return
  const seconds = Number(retryAfter)
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(retryAfter) - Date.now()
  if (!Number.isFinite(delay) || delay < 0) return
  return Math.min(delay, IN_FLIGHT_MAX_WAIT_MS)
}

export function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    function abort() {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}

async function failureDetails(response: Response) {
  const reader = response.body?.getReader()
  let body = ''
  if (reader) {
    const decoder = new TextDecoder()
    let remaining = 16_384
    try {
      while (remaining > 0) {
        const { done, value } = await reader.read()
        if (done) break
        body += decoder.decode(value.subarray(0, remaining), { stream: true })
        remaining -= value.byteLength
      }
      body += decoder.decode()
    } catch (cause) {
      return { response: workshopResponseDetails(response), cause }
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  }
  return { response: workshopResponseDetails(response, body) }
}

function failureFor(response: Response): RunFailure {
  const bucket = response.headers.get('X-Comfy-Error-Type')
  if (bucket === 'insufficient_credits') return 'noCredits'
  if (bucket === 'content_policy_violation') return 'policy'
  if (bucket === 'not_enabled' || bucket === 'forbidden') return 'unavailable'
  if (bucket === 'concurrency_limit_exceeded') return 'concurrency'
  if (response.status === 402) return 'noCredits'
  if (response.status === 429) return 'rateLimit'
  if (response.status === 409) return 'conflict'
  if (response.status === 400 || response.status === 422) return 'validation'
  if ([401, 403, 404].includes(response.status)) return 'unavailable'
  if (response.status === 504) return 'timeout'
  return 'provider'
}

export interface RouterRunOptions {
  readonly comfy_save_asset?: boolean
  readonly contract: WorkshopContract
  readonly body: Readonly<Record<string, unknown>>
  readonly token: string
  readonly freshToken?: () => Promise<string>
  readonly idempotencyKey: string
  readonly signal: AbortSignal
  readonly onRequestId?: (requestId: string | null) => void
  readonly rasterizeSvg?: WorkshopSvgRasterizer
}

interface RunProgress {
  readonly requestId: string | null
  readonly deadlineCollections: number
  readonly inFlightRetries: number
  readonly networkRecoveries: number
}

type ActiveRun = RunProgress &
  (
    | { readonly phase: 'request' }
    | { readonly phase: 'waiting'; readonly waitMs: number }
  )
type RunState =
  | ActiveRun
  | (RunProgress & {
      readonly phase: 'complete'
      readonly outputs: RunOutput[]
    })

export interface AttemptContext {
  readonly options: RouterRunOptions
  readonly body: string
  readonly controller: AbortController
  readonly signal: AbortSignal
  readonly deadlineAt: number
}

export async function withRunDeadline<T>(
  context: AttemptContext,
  limit: number,
  action: () => Promise<T>
): Promise<T> {
  const remaining = context.deadlineAt - Date.now()
  if (remaining <= 0) context.controller.abort()
  context.signal.throwIfAborted()
  const timeout = setTimeout(
    () => context.controller.abort(),
    Math.min(limit, remaining)
  )
  try {
    return await action()
  } finally {
    clearTimeout(timeout)
  }
}

function retryState(
  response: Response,
  progress: RunProgress
): ActiveRun | undefined {
  if (
    isParkedDeadline(response) &&
    progress.deadlineCollections < DEADLINE_COLLECTIONS
  )
    return {
      ...progress,
      phase: 'request',
      deadlineCollections: progress.deadlineCollections + 1
    }
  const waitMs = inFlightWaitMs(response)
  if (waitMs !== undefined && progress.inFlightRetries < IN_FLIGHT_RETRIES)
    return {
      ...progress,
      phase: 'waiting',
      waitMs,
      inFlightRetries: progress.inFlightRetries + 1
    }
  return undefined
}

export function throwRunFailure(
  error: unknown,
  context: AttemptContext,
  requestId: string | null
): never {
  context.options.signal.throwIfAborted()
  if (context.signal.aborted)
    throw new WorkshopRouterError('timeout', requestId)
  if (error instanceof WorkshopRouterError) throw error
  throw new WorkshopRouterError(
    error instanceof TypeError ? 'network' : 'client',
    requestId,
    {},
    undefined,
    'request'
  )
}

export async function settleRouterResponse(
  response: Response,
  requestId: string | null,
  context: AttemptContext
): Promise<RunOutput[]> {
  const { options, signal } = context
  try {
    if (!response.ok) {
      const details = await failureDetails(response)
      throw new WorkshopRouterError(
        failureFor(response),
        requestId,
        {},
        details.response,
        'request',
        { cause: details.cause }
      )
    }
    const outputs = await parseRouterResponse(
      options.contract,
      response,
      signal,
      options.rasterizeSvg
    )
    if (signal.aborted) {
      releaseRouterOutputs(outputs)
      signal.throwIfAborted()
    }
    return outputs
  } catch (error) {
    options.signal.throwIfAborted()
    if (signal.aborted)
      throw new WorkshopRouterError(
        'timeout',
        requestId,
        {},
        workshopResponseDetails(response),
        'response'
      )
    if (error instanceof WorkshopRouterError) throw error
    throw new WorkshopRouterError(
      'response',
      requestId,
      {},
      workshopResponseDetails(response),
      'response'
    )
  }
}

async function handleAttemptResponse(
  response: Response,
  progress: RunProgress,
  context: AttemptContext
): Promise<RunState> {
  context.options.onRequestId?.(progress.requestId)
  const retry = retryState(response, progress)
  if (retry) {
    await response.body?.cancel().catch(() => {})
    return retry
  }
  const outputs = await settleRouterResponse(
    response,
    progress.requestId,
    context
  )
  return { ...progress, phase: 'complete', outputs }
}

async function attempt(
  state: ActiveRun,
  context: AttemptContext
): Promise<RunState> {
  const { options, signal } = context
  const limit =
    state.phase === 'waiting' ? TOTAL_RUN_TIMEOUT_MS : RUN_TIMEOUT_MS
  return withRunDeadline(context, limit, async () => {
    if (state.phase === 'waiting') {
      await waitFor(state.waitMs, signal)
      const { waitMs, ...progress } = state
      return { ...progress, phase: 'request' }
    }
    const token = (await options.freshToken?.()) ?? options.token
    signal.throwIfAborted()
    const response = await fetch(
      `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${options.contract.id}`,
      {
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': options.idempotencyKey
        },
        body: context.body,
        signal
      }
    )
    return handleAttemptResponse(
      response,
      {
        requestId:
          response.headers.get('X-Comfy-Request-Id') ?? state.requestId,
        deadlineCollections: state.deadlineCollections,
        inFlightRetries: state.inFlightRetries,
        networkRecoveries: state.networkRecoveries
      },
      context
    )
  })
}

function recoverInterruptedRequest(
  error: unknown,
  state: RunProgress,
  context: AttemptContext
): ActiveRun {
  context.options.signal.throwIfAborted()
  const failure =
    error instanceof WorkshopRouterError
      ? error
      : new WorkshopRouterError(
          error instanceof TypeError ? 'network' : 'client',
          state.requestId
        )
  if (
    context.signal.aborted ||
    failure.reason !== 'network' ||
    state.networkRecoveries >= NETWORK_RECOVERIES
  )
    throw error
  return {
    ...state,
    phase: 'request',
    requestId: failure.requestId ?? state.requestId,
    networkRecoveries: state.networkRecoveries + 1
  }
}

export interface RouterRunResult {
  readonly outputs: RunOutput[]
  readonly requestId: string | null
  readonly deadlineCollections: number
}

export function createAttemptContext(
  options: RouterRunOptions
): AttemptContext {
  if (
    !options.token ||
    !options.idempotencyKey ||
    !/^[\w.-]+\/[\w.-]+$/.test(options.contract.id)
  )
    throw new WorkshopRouterError('unavailable')
  if (!validateWorkshopInput(options.body, options.contract.inputSchema))
    throw new WorkshopRouterError('validation')
  const controller = new AbortController()
  return {
    options,
    body: serializeRouterInput(options.body),
    controller,
    signal: AbortSignal.any([controller.signal, options.signal]),
    deadlineAt: Date.now() + TOTAL_RUN_TIMEOUT_MS
  }
}

export async function runSynchronousWorkshopRouter(
  options: RouterRunOptions,
  context: AttemptContext = createAttemptContext(options)
): Promise<RouterRunResult> {
  let state: RunState = {
    phase: 'request',
    requestId: null,
    deadlineCollections: 0,
    inFlightRetries: 0,
    networkRecoveries: 0
  }
  try {
    while (state.phase !== 'complete') {
      try {
        state = await attempt(state, context)
      } catch (error) {
        state = recoverInterruptedRequest(error, state, context)
      }
    }
    return {
      outputs: state.outputs,
      requestId: state.requestId,
      deadlineCollections: state.deadlineCollections
    }
  } catch (error) {
    options.signal.throwIfAborted()
    if (error instanceof WorkshopRouterError) throw error
    return throwRunFailure(error, context, state.requestId)
  }
}
