import type { WorkshopContract } from './workshop-contract'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import { serializeRouterInput } from './workshop-request'
import { parseRouterResponse, releaseRouterOutputs } from './workshop-response'
import type { RunFailure, RunOutput } from './workshop-run'
import { WorkshopRouterError } from './workshop-router-errors'
import { validateWorkshopInput } from './workshop-json-schema'

const RUN_TIMEOUT_MS = 660_000

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
}): Promise<{
  readonly outputs: RunOutput[]
  readonly requestId: string | null
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
  const timeout = setTimeout(() => requestController.abort(), RUN_TIMEOUT_MS)
  const signal = requestController.signal
  let requestId: string | null = null
  try {
    signal.throwIfAborted()
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
    if (!response.ok)
      throw new WorkshopRouterError(failureFor(response), requestId)
    const outputs = await parseRouterResponse(options.contract, response)
    if (signal.aborted) {
      releaseRouterOutputs(outputs)
      signal.throwIfAborted()
    }
    return { outputs, requestId }
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
