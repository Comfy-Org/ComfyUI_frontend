/**
 * Darkroom's calls to Comfy Router, made from the browser as the signed-in
 * account. Each image is one queued request: submit returns a request id at
 * once, the result is collected by polling, and a request can be cancelled
 * or picked up again after a reload. A queued submit takes no concurrency
 * slot, so Router holds the line and the page never has to.
 *
 * The Workshop's own queue client parses outputs through a model contract.
 * Darkroom reads the Gemini response itself, because it needs what that
 * parser drops: thinking previews, finish reasons and token usage.
 */
import type { DarkroomFailure } from '@/lib/darkroom/failure'
import { failureFromStatus } from '@/lib/darkroom/failure'
import type { DarkroomResponse } from '@/lib/darkroom/response'
import { parseDarkroomResponse } from '@/lib/darkroom/response'
import { darkroomModel } from '@/lib/darkroom/vocabulary'
import { combineAbortSignals, createTimeoutSignal } from '@/utils/abortSignal'

import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import { waitFor } from './workshop-router'
import { workshopResponseDetails } from './workshop-router-errors'

const REQUEST_TIMEOUT_MS = 120_000
const POLL_DEFAULT_MS = 2_000
const POLL_MIN_MS = 1_000
const POLL_MAX_MS = 10_000
const INTERRUPTION_RETRIES = 20
const DETAIL_LIMIT = 3_000
const REQUEST_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

export class DarkroomRouterError extends Error {
  constructor(
    readonly failure: DarkroomFailure,
    readonly detail = '',
    options?: ErrorOptions
  ) {
    super(`Darkroom request failed: ${failure}`, options)
  }
}

export type DarkroomToken = () => Promise<string>

interface Call {
  readonly model: string
  readonly token: DarkroomToken
  readonly signal: AbortSignal
}

export type DarkroomProgress =
  | { readonly phase: 'queued'; readonly ahead?: number }
  | { readonly phase: 'running' }

export interface DarkroomResult {
  readonly response: DarkroomResponse
  readonly fallbackProvider?: string
  readonly droppedParams?: string
}

function requestsUrl(model: string, requestId?: string): string {
  if (!darkroomModel(model)) throw new DarkroomRouterError('unavailable')
  const root = `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${model}/requests`
  if (requestId === undefined) return root
  if (!REQUEST_ID.test(requestId)) throw new DarkroomRouterError('lost')
  return `${root}/${requestId}`
}

async function routerFetch(
  url: string,
  call: Pick<Call, 'token' | 'signal'>,
  init: {
    readonly method: 'GET' | 'POST' | 'PUT'
    readonly body?: string
    readonly idempotencyKey?: string
    readonly keepalive?: boolean
  }
): Promise<Response> {
  const token = await call.token()
  call.signal.throwIfAborted()
  try {
    return await fetch(url, {
      method: init.method,
      body: init.body,
      keepalive: init.keepalive,
      credentials: 'omit',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(init.idempotencyKey
          ? { 'Idempotency-Key': init.idempotencyKey }
          : {})
      },
      signal: combineAbortSignals([
        call.signal,
        createTimeoutSignal(REQUEST_TIMEOUT_MS)
      ])
    })
  } catch (cause) {
    call.signal.throwIfAborted()
    throw new DarkroomRouterError('network', String(cause), { cause })
  }
}

async function refusal(response: Response): Promise<DarkroomRouterError> {
  const body = (await response.text().catch(() => '')).slice(0, DETAIL_LIMIT)
  const details = workshopResponseDetails(response, body)
  return new DarkroomRouterError(
    failureFromStatus(details.status, details.errorType),
    `HTTP ${details.status}${details.errorType ? ` ${details.errorType}` : ''}\n${body}`.trim()
  )
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object'
    ? Reflect.get(value, key)
    : undefined
}

function progressOf(handle: unknown): DarkroomProgress {
  if (field(handle, 'status') !== 'IN_QUEUE') return { phase: 'running' }
  const ahead = field(handle, 'queue_position')
  return {
    phase: 'queued',
    ...(typeof ahead === 'number' && ahead >= 0 ? { ahead } : {})
  }
}

export interface DarkroomSubmission {
  readonly requestId: string
  readonly progress: DarkroomProgress
}

/**
 * Hands one image to Router. Funds are checked here, before anything is
 * queued, so an empty balance is refused at once and nothing is charged.
 */
export async function submitDarkroomImage(
  call: Call & {
    readonly body: Readonly<Record<string, unknown>>
    readonly idempotencyKey: string
  }
): Promise<DarkroomSubmission> {
  const response = await routerFetch(requestsUrl(call.model), call, {
    method: 'POST',
    body: JSON.stringify(call.body),
    idempotencyKey: call.idempotencyKey
  })
  if (!response.ok) throw await refusal(response)
  const handle: unknown = await response.json().catch(() => undefined)
  const requestId = field(handle, 'request_id')
  if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId))
    throw new DarkroomRouterError('generic', 'Router returned no request id')
  return { requestId, progress: progressOf(handle) }
}

function pollDelayMs(response: Response): number {
  const seconds = Number(response.headers.get('Retry-After')?.trim() || NaN)
  if (!Number.isFinite(seconds)) return POLL_DEFAULT_MS
  return Math.min(Math.max(seconds * 1000, POLL_MIN_MS), POLL_MAX_MS)
}

type Collecting = Call & {
  readonly requestId: string
  readonly onProgress?: (progress: DarkroomProgress) => void
}

/** What one poll found: the answer, or how long to wait before the next. */
type Poll =
  | { readonly result: DarkroomResult }
  | { readonly waitMs: number; readonly interrupted: boolean }

async function resultOf(response: Response): Promise<DarkroomResult> {
  const payload: unknown = await response.json().catch((cause: unknown) => {
    throw new DarkroomRouterError('generic', 'Unreadable result', { cause })
  })
  return {
    response: parseDarkroomResponse(payload),
    fallbackProvider:
      response.headers.get('X-Comfy-Router-Fallback-Provider') ?? undefined,
    droppedParams:
      response.headers.get('X-Comfy-Router-Dropped-Params') ?? undefined
  }
}

async function readPoll(
  response: Response,
  call: Collecting,
  mayRetry: boolean
): Promise<Poll> {
  if (response.status === 202) {
    const handle: unknown = await response.json().catch(() => undefined)
    call.onProgress?.(progressOf(handle))
    return { waitMs: pollDelayMs(response), interrupted: false }
  }
  const busy = response.status === 429 || response.status === 503
  if (busy && mayRetry) {
    await response.body?.cancel().catch(() => {})
    return { waitMs: pollDelayMs(response), interrupted: true }
  }
  if (response.status === 404) {
    await response.body?.cancel().catch(() => {})
    throw new DarkroomRouterError('lost', 'HTTP 404')
  }
  if (!response.ok) throw await refusal(response)
  return { result: await resultOf(response) }
}

async function poll(
  url: string,
  call: Collecting,
  interruptions: number
): Promise<Poll> {
  const mayRetry = interruptions < INTERRUPTION_RETRIES
  let response: Response
  try {
    response = await routerFetch(url, call, { method: 'GET' })
  } catch (error) {
    call.signal.throwIfAborted()
    const dropped =
      error instanceof DarkroomRouterError && error.failure === 'network'
    if (!dropped || !mayRetry) throw error
    return {
      waitMs: Math.min(POLL_DEFAULT_MS * 2 ** (interruptions + 1), POLL_MAX_MS),
      interrupted: true
    }
  }
  return readPoll(response, call, mayRetry)
}

/**
 * Waits for a queued image and returns Router's answer. A dropped connection
 * or a busy Router is waited out, because the request keeps running on
 * Router's side whether or not the page is listening.
 */
export async function collectDarkroomImage(
  call: Collecting
): Promise<DarkroomResult> {
  const url = requestsUrl(call.model, call.requestId)
  let interruptions = 0
  for (;;) {
    const step = await poll(url, call, interruptions)
    if ('result' in step) return step.result
    interruptions = step.interrupted ? interruptions + 1 : 0
    await waitFor(step.waitMs, call.signal)
  }
}

/**
 * Stops a request. One still in line is dropped before the model runs, so
 * nothing is charged. `keepalive` lets it outlive a page that is closing.
 */
export async function cancelDarkroomImage(
  call: Pick<Call, 'model' | 'token'> & { readonly requestId: string }
): Promise<void> {
  const response = await routerFetch(
    `${requestsUrl(call.model, call.requestId)}/cancel`,
    { token: call.token, signal: new AbortController().signal },
    { method: 'PUT', keepalive: true }
  )
  await response.body?.cancel().catch(() => {})
}

/**
 * How many calls the account may have in flight at once: -1 is unlimited and
 * 0 means partner models are turned off for it. Unknown when the read fails,
 * which the page treats as the default.
 */
export async function readDarkroomConcurrency(
  token: DarkroomToken,
  signal: AbortSignal
): Promise<number | undefined> {
  try {
    const response = await routerFetch(
      `${WORKSHOP_ROUTER_BASE_URL}/customers/me/partner-node-concurrency`,
      { token, signal },
      { method: 'GET' }
    )
    if (!response.ok) return undefined
    const limit = field(await response.json(), 'limit')
    return typeof limit === 'number' && Number.isInteger(limit)
      ? limit
      : undefined
  } catch {
    signal.throwIfAborted()
    return undefined
  }
}
