import { z } from 'zod'

import { t } from '@/i18n'
import type {
  ExecutableNode,
  MediaItem
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import type {
  Executor,
  RunOutcome,
  RunRequest
} from '@/renderer/extensions/superComfy/engine/types'
import type {
  RouterFailure,
  RouterHeaders,
  RouterRequest,
  RouterResponse
} from '@/renderer/extensions/superComfy/router/routerApi'
import {
  routerFailureMessage,
  routerFetch,
  routerModelPath
} from '@/renderer/extensions/superComfy/router/routerApi'
import {
  MAX_BODY_BYTES,
  bodyBytes,
  buildRouterBody
} from '@/renderer/extensions/superComfy/router/routerBody'
import type { RouterContractLoad } from '@/renderer/extensions/superComfy/router/routerCatalog'
import { loadRouterContract } from '@/renderer/extensions/superComfy/router/routerCatalog'
import type {
  EncodeOutcome,
  MediaEncoder
} from '@/renderer/extensions/superComfy/router/routerMedia'
import {
  createMediaEncoder,
  persistRouterOutput
} from '@/renderer/extensions/superComfy/router/routerMedia'
import type { RouterPayload } from '@/renderer/extensions/superComfy/router/routerResult'
import { extractRouterOutputs } from '@/renderer/extensions/superComfy/router/routerResult'
import type {
  EncodedInputs,
  EncodedMedia,
  JsonObject,
  RouterContract,
  RouterPortSpec
} from '@/renderer/extensions/superComfy/router/routerTypes'

interface RunContext {
  contract: RouterContract
  body: JsonObject
  idempotencyKey: string
  modelPath: string
  signal: AbortSignal
  onProgress: RunRequest['onProgress']
}

type Completed =
  | { ok: true; payload: RouterPayload; headers: RouterHeaders }
  | { ok: false; message: string }

type PollStep =
  | { kind: 'wait'; delayMs?: number; error?: string }
  | { kind: 'done'; outcome: Completed }

interface PollState {
  waitMs: number
  intervalMs: number
  errors: number
  deadline: number
}

interface RetryCounts {
  transient: number
  limited: number
}

type EncodedPort = [name: string, outcomes: EncodeOutcome[]]

const CONCURRENCY = 4
const SUBMIT_TIMEOUT_MS = 60_000
const STATUS_TIMEOUT_MS = 30_000
const RESULT_TIMEOUT_MS = 120_000
const CANCEL_TIMEOUT_MS = 10_000
const SYNC_TEXT_TIMEOUT_MS = 300_000
const SYNC_MEDIA_TIMEOUT_MS = 180_000
const SUBMIT_BACKOFF_MS = [1000, 2000, 4000]
const RATE_LIMIT_RETRIES = 3
const RATE_LIMIT_FALLBACK_MS = 5000
const POLL_START_MS = 3000
const POLL_STEP_MS = 500
const POLL_MAX_MS = 8000
const POLL_ERROR_LIMIT = 10
const POLL_DEADLINE_MS = 90 * 60 * 1000
const BYTES_PER_MB = 1024 * 1024
const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([408, 425])

const zSubmitted = z.looseObject({
  request_id: z.string(),
  queue_position: z.number().nullish()
})

const zStatus = z.looseObject({
  status: z.string(),
  queue_position: z.number().nullish(),
  error_type: z.string().nullish()
})

function waitFor(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      resolve(false)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(true)
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function stopped(): Completed {
  return { ok: false, message: t('superComfy.node.noOutput') }
}

function failedWith(failure: RouterFailure): Completed {
  return { ok: false, message: routerFailureMessage(failure) }
}

function isRefusedWith(
  response: RouterResponse,
  matches: (status: number) => boolean
): boolean {
  return (
    !response.ok && response.reason === 'refused' && matches(response.status)
  )
}

function isTransient(response: RouterResponse): boolean {
  if (!response.ok && response.reason === 'network') return true
  return isRefusedWith(
    response,
    (status) => TRANSIENT_STATUSES.has(status) || status >= 500
  )
}

function retryAfterOf(response: RouterResponse): number | undefined {
  return !response.ok && response.reason === 'refused'
    ? response.headers.retryAfterMs
    : undefined
}

function nextRetry(
  response: RouterResponse,
  counts: RetryCounts
): { delayMs: number; counts: RetryCounts } | null {
  if (isRefusedWith(response, (status) => status === 429)) {
    if (counts.limited >= RATE_LIMIT_RETRIES) return null
    return {
      delayMs: retryAfterOf(response) ?? RATE_LIMIT_FALLBACK_MS,
      counts: { ...counts, limited: counts.limited + 1 }
    }
  }
  if (!isTransient(response) || counts.transient >= SUBMIT_BACKOFF_MS.length) {
    return null
  }
  return {
    delayMs: SUBMIT_BACKOFF_MS[counts.transient],
    counts: { ...counts, transient: counts.transient + 1 }
  }
}

async function sendWithRetries(
  request: RouterRequest & { signal: AbortSignal },
  counts: RetryCounts = { transient: 0, limited: 0 }
): Promise<RouterResponse> {
  const response = await routerFetch(request)
  const retry = request.signal.aborted ? null : nextRetry(response, counts)
  if (!retry) return response
  if (!(await waitFor(retry.delayMs, request.signal))) return response
  return sendWithRetries(request, retry.counts)
}

function completedFrom(
  response: Extract<RouterResponse, { ok: true }>
): Completed {
  return {
    ok: true,
    payload: {
      json: response.json,
      blob: response.blob,
      contentType: response.contentType
    },
    headers: response.headers
  }
}

async function runSync(context: RunContext): Promise<Completed> {
  const response = await sendWithRetries({
    path: `/v2/models/${context.modelPath}`,
    method: 'POST',
    body: context.body,
    idempotencyKey: context.idempotencyKey,
    signal: context.signal,
    timeoutMs:
      context.contract.modality === 'text'
        ? SYNC_TEXT_TIMEOUT_MS
        : SYNC_MEDIA_TIMEOUT_MS
  })
  return response.ok ? completedFrom(response) : failedWith(response)
}

function requestPath(context: RunContext, requestId: string): string {
  return `/v2/models/${context.modelPath}/requests/${encodeURIComponent(requestId)}`
}

function pollFailure(failure: RouterFailure): PollStep {
  if (failure.reason === 'network') {
    return { kind: 'wait', error: failure.message }
  }
  if (
    failure.reason === 'refused' &&
    (failure.status === 429 || failure.status >= 500)
  ) {
    return {
      kind: 'wait',
      error: routerFailureMessage(failure),
      delayMs: failure.headers.retryAfterMs
    }
  }
  return { kind: 'done', outcome: failedWith(failure) }
}

function withErrorType(
  failure: RouterFailure,
  errorType: string | undefined
): RouterFailure {
  return failure.reason === 'refused' && !failure.errorType && errorType
    ? { ...failure, errorType }
    : failure
}

async function resultStep(
  context: RunContext,
  requestId: string,
  errorType: string | undefined
): Promise<PollStep> {
  const result = await routerFetch({
    path: requestPath(context, requestId),
    method: 'GET',
    signal: context.signal,
    timeoutMs: RESULT_TIMEOUT_MS
  })
  if (!result.ok) return pollFailure(withErrorType(result, errorType))
  if (result.status === 202) {
    return { kind: 'wait', delayMs: result.headers.retryAfterMs }
  }
  return { kind: 'done', outcome: completedFrom(result) }
}

async function pollStep(
  context: RunContext,
  requestId: string
): Promise<PollStep> {
  const response = await routerFetch({
    path: `${requestPath(context, requestId)}/status`,
    method: 'GET',
    signal: context.signal,
    timeoutMs: STATUS_TIMEOUT_MS
  })
  if (!response.ok) return pollFailure(response)
  const parsed = zStatus.safeParse(response.json)
  if (!parsed.success) return { kind: 'wait', error: String(response.status) }
  const { status, queue_position, error_type } = parsed.data
  if (status === 'COMPLETED') {
    return resultStep(context, requestId, error_type ?? undefined)
  }
  context.onProgress({
    queuePosition:
      status === 'IN_QUEUE' ? (queue_position ?? undefined) : undefined
  })
  return { kind: 'wait', delayMs: response.headers.retryAfterMs }
}

async function poll(
  context: RunContext,
  requestId: string,
  state: PollState
): Promise<Completed> {
  if (Date.now() >= state.deadline) {
    return { ok: false, message: t('superComfy.node.timedOut') }
  }
  if (!(await waitFor(state.waitMs, context.signal))) return stopped()
  const step = await pollStep(context, requestId)
  if (step.kind === 'done') return step.outcome
  const errors = step.error === undefined ? 0 : state.errors + 1
  if (step.error !== undefined && errors >= POLL_ERROR_LIMIT) {
    return { ok: false, message: step.error }
  }
  const intervalMs = Math.min(state.intervalMs + POLL_STEP_MS, POLL_MAX_MS)
  return poll(context, requestId, {
    ...state,
    errors,
    intervalMs,
    waitMs: step.delayMs ?? intervalMs
  })
}

async function cancelRequest(
  context: RunContext,
  requestId: string
): Promise<void> {
  await routerFetch({
    path: `${requestPath(context, requestId)}/cancel`,
    method: 'POST',
    timeoutMs: CANCEL_TIMEOUT_MS
  })
}

function isNotEnabled(response: RouterResponse): boolean {
  return (
    !response.ok &&
    response.reason === 'refused' &&
    response.status === 403 &&
    response.errorType === 'not_enabled'
  )
}

async function runQueued(context: RunContext): Promise<Completed> {
  const submitted = await sendWithRetries({
    path: `/v2/models/${context.modelPath}/requests`,
    method: 'POST',
    body: context.body,
    idempotencyKey: context.idempotencyKey,
    signal: context.signal,
    timeoutMs: SUBMIT_TIMEOUT_MS
  })
  if (isNotEnabled(submitted)) return runSync(context)
  if (!submitted.ok) return failedWith(submitted)
  const parsed = zSubmitted.safeParse(submitted.json)
  if (!parsed.success) {
    return { ok: false, message: t('superComfy.node.noOutput') }
  }
  const requestId = parsed.data.request_id
  context.onProgress({ queuePosition: parsed.data.queue_position ?? undefined })
  const outcome = await poll(context, requestId, {
    waitMs: POLL_START_MS,
    intervalMs: POLL_START_MS,
    errors: 0,
    deadline: Date.now() + POLL_DEADLINE_MS
  })
  if (context.signal.aborted) void cancelRequest(context, requestId)
  return outcome
}

function itemsAt(request: RunRequest, port: string): MediaItem[] {
  return Object.hasOwn(request.run.inputs, port) ? request.run.inputs[port] : []
}

function textOf(items: readonly MediaItem[]): string {
  return items
    .flatMap((item) => (item.kind === 'text' ? [item.text] : []))
    .join('\n')
}

async function encodePort(
  port: RouterPortSpec,
  request: RunRequest,
  encode: MediaEncoder
): Promise<EncodedPort> {
  const outcomes = await Promise.all(
    itemsAt(request, port.name).map((item) =>
      encode(item, port.encoding ?? 'dataUrl', request.signal)
    )
  )
  return [port.name, outcomes]
}

function encodedValues(outcomes: readonly EncodeOutcome[]): EncodedMedia[] {
  return outcomes.flatMap((outcome) => (outcome.ok ? [outcome.value] : []))
}

async function encodeInputs(
  contract: RouterContract,
  request: RunRequest,
  encode: MediaEncoder
): Promise<
  { ok: true; inputs: EncodedInputs } | { ok: false; message: string }
> {
  const textPorts = contract.inputs.filter((port) => port.modality === 'text')
  const mediaPorts = contract.inputs.filter((port) => port.modality !== 'text')
  const encoded = await Promise.all(
    mediaPorts.map((port) => encodePort(port, request, encode))
  )
  const failure = encoded
    .flatMap(([, outcomes]) => outcomes)
    .find((outcome) => !outcome.ok)
  if (failure) return failure
  return {
    ok: true,
    inputs: {
      text: Object.fromEntries(
        textPorts.flatMap((port): [string, string][] => {
          const text = textOf(itemsAt(request, port.name))
          return text === '' ? [] : [[port.name, text]]
        })
      ),
      media: Object.fromEntries(
        encoded.map(([name, outcomes]): [string, EncodedMedia[]] => [
          name,
          encodedValues(outcomes)
        ])
      )
    }
  }
}

function outputName(context: RunContext): string {
  const model = context.contract.modelId
    .slice(context.contract.modelId.indexOf('/') + 1)
    .replace(/[^a-z0-9.-]+/gi, '-')
  return `supercomfy-${model}-${context.idempotencyKey.slice(0, 8)}`
}

function noticeOf(headers: RouterHeaders): string | undefined {
  return headers.droppedParams
    ? t('superComfy.node.droppedParams', { params: headers.droppedParams })
    : undefined
}

async function collectOutputs(
  context: RunContext,
  completed: Extract<Completed, { ok: true }>
): Promise<RunOutcome> {
  const extracted = extractRouterOutputs(context.contract, completed.payload)
  if (!extracted.ok) {
    return {
      ok: false,
      message: extracted.message ?? t('superComfy.node.noOutput')
    }
  }
  const name = outputName(context)
  const persisted = await Promise.all(
    extracted.outputs.map((raw, index) =>
      persistRouterOutput(
        raw,
        context.contract.modality,
        `${name}-${index}`,
        context.signal
      )
    )
  )
  const items = persisted.flatMap((outcome) =>
    outcome.ok ? [outcome.item] : []
  )
  const failure = persisted.find((outcome) => !outcome.ok)
  if (items.length === 0) {
    return failure ?? { ok: false, message: t('superComfy.node.noOutput') }
  }
  return {
    ok: true,
    outputs: { out: items },
    creditsUsed: completed.headers.creditsUsed,
    notice: noticeOf(completed.headers)
  }
}

async function executeRun(
  contract: RouterContract,
  request: RunRequest,
  encode: MediaEncoder
): Promise<RunOutcome> {
  const encoded = await encodeInputs(contract, request, encode)
  if (!encoded.ok) return encoded
  const built = buildRouterBody(contract, encoded.inputs, request.node.values)
  if (!built.ok) {
    return { ok: false, message: t('superComfy.model.needsFirstFrame') }
  }
  const size = bodyBytes(built.body)
  if (size > MAX_BODY_BYTES) {
    return {
      ok: false,
      message: t('superComfy.media.tooLarge', {
        size: (size / BYTES_PER_MB).toFixed(1)
      })
    }
  }
  const context: RunContext = {
    contract,
    body: built.body,
    idempotencyKey: crypto.randomUUID(),
    modelPath: routerModelPath(contract.modelId),
    signal: request.signal,
    onProgress: request.onProgress
  }
  const completed =
    contract.transport === 'sync'
      ? await runSync(context)
      : await runQueued(context)
  return completed.ok ? collectOutputs(context, completed) : completed
}

function contractFor(node: ExecutableNode): Promise<RouterContractLoad> {
  if (node.kind !== 'generate' || node.modelId === null) {
    return Promise.resolve({ ok: false, message: t('superComfy.model.pick') })
  }
  return loadRouterContract(node.modelId, node.modality)
}

export function createRouterExecutor(): Executor {
  return {
    concurrency: CONCURRENCY,
    begin: (node) => {
      const contract = contractFor(node)
      const encode = createMediaEncoder()
      return {
        run: async (request) => {
          const loaded = await contract
          if (!loaded.ok) return loaded
          return executeRun(loaded.contract, request, encode)
        },
        dispose: () => Promise.resolve()
      }
    }
  }
}
