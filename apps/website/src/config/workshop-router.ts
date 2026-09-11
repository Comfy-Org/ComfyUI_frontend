import type { WorkshopContract } from './workshop-contract'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import { serializeRouterInput } from './workshop-request'
import { parseRouterResponse, releaseRouterOutputs } from './workshop-response'
import type { RunFailure, RunOutput } from './workshop-run'
import { WorkshopRouterError } from './workshop-router-errors'
import { validateWorkshopInput } from './workshop-json-schema'
import type { WorkshopSvgRasterizer } from './workshop-svg-output'

const RUN_TIMEOUT_MS = 660_000
const DEADLINE_COLLECTIONS = 3
const IN_FLIGHT_RETRIES = 5
const IN_FLIGHT_MAX_WAIT_MS = 10_000

function isParkedDeadline(response: Response): boolean {
  return (
    response.status === 504 &&
    response.headers.get('X-Comfy-Error-Type') === 'deadline_exceeded'
  )
}

function inFlightWaitMs(response: Response): number | undefined {
  const retryAfter = response.headers.get('Retry-After')
  if (response.status !== 409 || retryAfter === null) return
  const seconds = Number(retryAfter)
  if (!Number.isFinite(seconds) || seconds < 0) return
  return Math.min(seconds * 1000, IN_FLIGHT_MAX_WAIT_MS)
}

function waitFor(ms: number, signal: AbortSignal): Promise<void> {
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
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  }
  return {
    status: response.status,
    errorType: response.headers.get('X-Comfy-Error-Type'),
    retryAfter: response.headers.get('Retry-After'),
    concurrencyLimit: response.headers.get('X-Concurrency-Limit'),
    concurrencyCurrent: response.headers.get('X-Concurrency-Current'),
    concurrencyRemaining: response.headers.get('X-Concurrency-Remaining'),
    body
  }
}

function failureFor(response: Response): RunFailure {
  const bucket = response.headers.get('X-Comfy-Error-Type')
  if (bucket === 'insufficient_credits') return 'noCredits'
  if (bucket === 'content_policy_violation') return 'policy'
  if (bucket === 'not_enabled' || bucket === 'forbidden') return 'unavailable'
  if (response.status === 402) return 'noCredits'
  if (response.status === 429) return 'rateLimit'
  if (response.status === 400 || response.status === 422) return 'validation'
  if ([401, 403, 404].includes(response.status)) return 'unavailable'
  if (response.status === 504) return 'timeout'
  return 'provider'
}

export async function runWorkshopRouter(options: {
  readonly contract: WorkshopContract
  readonly body: Readonly<Record<string, unknown>>
  readonly token: string
  readonly idempotencyKey: string
  readonly signal: AbortSignal
  readonly onRequestId?: (requestId: string | null) => void
  readonly rasterizeSvg?: WorkshopSvgRasterizer
}): Promise<{
  readonly outputs: RunOutput[]
  readonly requestId: string | null
  readonly deadlineCollections: number
}> {
  if (
    !options.token ||
    !options.idempotencyKey ||
    !/^[\w.-]+\/[\w.-]+$/.test(options.contract.id)
  )
    throw new WorkshopRouterError('unavailable')
  if (!validateWorkshopInput(options.body, options.contract.inputSchema))
    throw new WorkshopRouterError('validation')
  const body = serializeRouterInput(options.body)
  const requestController = new AbortController()
  const abortFromCaller = () => requestController.abort(options.signal.reason)
  options.signal.addEventListener('abort', abortFromCaller, { once: true })
  if (options.signal.aborted) abortFromCaller()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const signal = requestController.signal
  let requestId: string | null = null
  let deadlineCollections = 0
  let inFlightRetries = 0
  try {
    for (;;) {
      signal.throwIfAborted()
      clearTimeout(timeout)
      timeout = setTimeout(() => requestController.abort(), RUN_TIMEOUT_MS)
      const response = await fetch(
        `${WORKSHOP_ROUTER_BASE_URL}/v2/models/${options.contract.id}`,
        {
          method: 'POST',
          credentials: 'omit',
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${options.token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': options.idempotencyKey
          },
          body,
          signal
        }
      )
      requestId = response.headers.get('X-Comfy-Request-Id')
      options.onRequestId?.(requestId)
      // Router parks a submitted generation at its synchronous deadline and
      // hands it back to a request repeating the same key and body.
      if (
        isParkedDeadline(response) &&
        deadlineCollections < DEADLINE_COLLECTIONS
      ) {
        deadlineCollections += 1
        await response.body?.cancel().catch(() => {})
        continue
      }
      const inFlightWait = inFlightWaitMs(response)
      if (inFlightWait !== undefined && inFlightRetries < IN_FLIGHT_RETRIES) {
        inFlightRetries += 1
        await response.body?.cancel().catch(() => {})
        await waitFor(inFlightWait, signal)
        continue
      }
      if (!response.ok)
        throw new WorkshopRouterError(
          failureFor(response),
          requestId,
          {},
          await failureDetails(response)
        )
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
      return { outputs, requestId, deadlineCollections }
    }
  } catch (error) {
    options.signal.throwIfAborted()
    if (signal.aborted) throw new WorkshopRouterError('timeout', requestId)
    if (error instanceof WorkshopRouterError) throw error
    throw new WorkshopRouterError('provider', requestId)
  } finally {
    clearTimeout(timeout)
    options.signal.removeEventListener('abort', abortFromCaller)
  }
}
