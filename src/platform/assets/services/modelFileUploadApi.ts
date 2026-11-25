import {
  awaitWithAbort,
  combineAbortSignals,
  createTimeoutSignal,
  throwIfAborted
} from '@comfyorg/api-client/abortSignal'
import type { z } from 'zod'

import type {
  zCompleteModelUploadBody,
  zReportModelUploadEventBody,
  zStartModelUploadBody
} from '@comfyorg/ingest-types/zod'
import {
  zCompleteModelUploadResponse,
  zErrorResponse,
  zStartModelUploadResponse
} from '@comfyorg/ingest-types/zod'

import { api } from '@/scripts/api'

export const UPLOADS_ENDPOINT = '/assets/uploads'

export class ModelUploadRolloutDisabled extends Error {}
const STORAGE_OBJECT_ALREADY_WRITTEN = 412
const UPLOAD_CLIENT = 'editor'
const TRANSFER_REPORT_TIMEOUT_MS = 5_000

export function isSupportedModelFileName(name: string): boolean {
  return name.toLowerCase().endsWith('.safetensors')
}

type ModelFileUploadFailure =
  | 'unsupportedFile'
  | 'unsupportedType'
  | 'tooLarge'
  | 'storageLimit'
  | 'featureDisabled'
  | 'accessDenied'
  | 'privateModelsDisabled'
  | 'planUnavailable'
  | 'sessionExpired'
  | 'cancelled'
  | 'failed'

const FAILURE_BY_CODE: Partial<Record<string, ModelFileUploadFailure>> = {
  FEATURE_DISABLED: 'featureDisabled',
  UNSUPPORTED_FILE_TYPE: 'unsupportedFile',
  UNSUPPORTED_MODEL_TYPE: 'unsupportedType',
  PRIVATE_MODELS_DISABLED: 'privateModelsDisabled',
  PRIVATE_MODELS_UNAVAILABLE: 'planUnavailable',
  UPLOAD_NOT_FOUND: 'sessionExpired'
}

interface ModelFileUploadStopped {
  ok: false
  reason: ModelFileUploadFailure
  message?: string
  cause?: unknown
}

/** The outcome of sending one model file: the server task that stores it, or why it stopped. */
export type ModelFileUploadResult =
  | { ok: true; taskId: string }
  | ModelFileUploadStopped

/** Sends one JSON request to an upload route, such as `/assets/uploads`. */
export type UploadRouteRequest = (
  route: string,
  init: RequestInit
) => Promise<Response>

interface ModelFileUploadOptions {
  tags: string[]
  signal: AbortSignal
  onProgress: (sentBytes: number) => void
  onReconnecting?: (reconnecting: boolean) => void
  onCompleting?: (staged: StagedModelFile) => void
  canStartTransfer?: () => boolean
  canSendBytes?: () => Promise<boolean>
  resumeFrom?: StagedModelFile
  startTimeoutMs?: number
  completionTimeoutMs?: number
  request?: UploadRouteRequest
}

async function readFailure(res: Response): Promise<ModelFileUploadStopped> {
  const body = zErrorResponse.safeParse(await res.json().catch(() => null))
  if (body.success) {
    const { code, message } = body.data
    if (code === 'FILE_TOO_LARGE')
      return { ok: false, reason: 'tooLarge', message }
    if (code === 'MODEL_STORAGE_LIMIT_REACHED')
      return { ok: false, reason: 'storageLimit', message }
    const reason = FAILURE_BY_CODE[code]
    if (reason) return { ok: false, reason }
  }
  if (res.status === 401 || res.status === 403)
    return { ok: false, reason: 'accessDenied' }
  return {
    ok: false,
    reason: 'failed',
    cause: `${res.status} ${body.success ? body.data.code : ''}`
  }
}

interface StorageAnswer {
  status: number
  range: string | null
}

async function putFile(
  start: Pick<
    ReturnType<typeof zStartModelUploadResponse.parse>,
    'method' | 'upload_url' | 'headers'
  >,
  file: Blob | null,
  {
    signal,
    onProgress,
    canStartTransfer,
    canSendBytes
  }: ModelFileUploadOptions,
  contentRange?: string
): Promise<StorageAnswer | ModelFileUploadStopped> {
  const granted =
    file && canSendBytes && !signal.aborted
      ? await awaitWithAbort(canSendBytes(), signal)
      : undefined
  if (signal.aborted) return { ok: false, reason: 'cancelled' }
  if (file && (granted === false || canStartTransfer?.() === false))
    return { ok: false, reason: 'featureDisabled' }
  return new Promise((resolve) => {
    const request = new XMLHttpRequest()
    let timer: ReturnType<typeof setTimeout> | undefined
    let loaded = 0
    const resetDeadline = () => {
      if (!contentRange) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        resolve({ status: 0, range: null })
        request.abort()
      }, 30_000)
    }
    request.upload.onprogress = (event) => {
      if (event.loaded > loaded) {
        loaded = event.loaded
        resetDeadline()
      }
      if (file) onProgress(event.loaded)
    }
    request.onload = () =>
      resolve({
        status: request.status,
        range: request.getResponseHeader('Range')
      })
    request.onerror = request.ontimeout = () =>
      resolve({ status: 0, range: null })
    request.onabort = () => resolve({ ok: false, reason: 'cancelled' })
    const abort = () => request.abort()
    const cleanup = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
    request.onloadend = cleanup
    signal.addEventListener('abort', abort, { once: true })
    try {
      request.open(start.method, start.upload_url)
      for (const [name, value] of Object.entries(start.headers)) {
        request.setRequestHeader(name, value)
      }
      if (contentRange) request.setRequestHeader('Content-Range', contentRange)
      resetDeadline()
      request.send(file)
    } catch {
      cleanup()
      resolve({ ok: false, reason: 'failed', cause: 'storage request failed' })
    }
  })
}

function readStorageAnswer(status: number): ModelFileUploadStopped | undefined {
  if (status >= 200 && status < 300) return undefined
  if (status === STORAGE_OBJECT_ALREADY_WRITTEN) return undefined
  return { ok: false, reason: 'failed', cause: `storage ${status}` }
}

function retryWait(delay: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve(!signal.aborted)
    }
    const timer = setTimeout(finish, delay)
    signal.addEventListener('abort', finish, { once: true })
  })
}

function heldBytes(range: string | null, size: number): number | undefined {
  if (range === null) return 0
  const match = /^bytes=0-(\d+)$/.exec(range)
  const next = match ? Number(match[1]) + 1 : NaN
  return Number.isSafeInteger(next) && next > 0 && next <= size
    ? next
    : undefined
}

type ResumableAnswer =
  | { status: 'complete' | 'retry' }
  | { status: 'held'; bytes: number }
  | ModelFileUploadStopped

function readResumableAnswer(
  answer: StorageAnswer,
  size: number
): ResumableAnswer {
  const { status, range } = answer
  if ([200, 201, 412].includes(status)) return { status: 'complete' }
  if (status === 404 || status === 410) {
    return { ok: false, reason: 'sessionExpired' }
  }
  if (status === 308) {
    const bytes = heldBytes(range, size)
    return bytes === undefined
      ? { ok: false, reason: 'failed', cause: 'invalid storage range' }
      : { status: 'held', bytes }
  }
  if ([0, 408, 429].includes(status) || status >= 500)
    return { status: 'retry' }
  return { ok: false, reason: 'failed', cause: `storage ${status}` }
}

interface TransferPosition {
  offset: number
  query: boolean
  delay: number
  resumed: boolean
}

async function sendPiece(
  start: ReturnType<typeof zStartModelUploadResponse.parse>,
  file: File,
  options: ModelFileUploadOptions,
  { offset, query }: TransferPosition
): Promise<ResumableAnswer> {
  const chunkSize = Number(start.chunk_size_bytes ?? 64 * 1024 * 1024)
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    return { ok: false, reason: 'failed', cause: 'invalid upload piece size' }
  }
  const end = Math.min(offset + chunkSize, file.size)
  if (!query) options.onReconnecting?.(false)
  const answer = await putFile(
    start,
    query ? null : file.slice(offset, end),
    { ...options, onProgress: (sent) => options.onProgress(offset + sent) },
    query ? `bytes */${file.size}` : `bytes ${offset}-${end - 1}/${file.size}`
  )
  return 'status' in answer ? readResumableAnswer(answer, file.size) : answer
}

function nextPosition(
  previous: TransferPosition,
  next: number,
  size: number
): TransferPosition {
  return {
    offset: next,
    query: next >= size || (!previous.query && next <= previous.offset),
    delay: next > previous.offset ? 1000 : previous.delay,
    resumed: previous.resumed || (previous.query && next > 0 && next < size)
  }
}

interface Transfer {
  stopped?: ModelFileUploadStopped
  resumed?: boolean
}

async function putResumable(
  start: ReturnType<typeof zStartModelUploadResponse.parse>,
  file: File,
  options: ModelFileUploadOptions
): Promise<Transfer> {
  let position: TransferPosition = {
    offset: 0,
    query: false,
    delay: 1000,
    resumed: false
  }
  while (!options.signal.aborted) {
    const outcome = await sendPiece(start, file, options, position)
    if ('ok' in outcome) return { stopped: outcome, resumed: position.resumed }
    if (outcome.status === 'complete') {
      options.onProgress(file.size)
      options.onReconnecting?.(false)
      return { resumed: position.resumed }
    }
    if (outcome.status === 'held') {
      position = nextPosition(position, outcome.bytes, file.size)
      options.onProgress(position.offset)
      if (!position.query) continue
    }
    options.onReconnecting?.(true)
    if (!(await retryWait(position.delay, options.signal))) break
    position = {
      ...position,
      query: true,
      delay: Math.min(position.delay * 2, 60_000)
    }
  }
  return {
    stopped: { ok: false, reason: 'cancelled' },
    resumed: position.resumed
  }
}

async function putOnce(
  start: ReturnType<typeof zStartModelUploadResponse.parse>,
  file: File,
  options: ModelFileUploadOptions
): Promise<Transfer> {
  const answer = await putFile(start, file, options)
  return {
    stopped: 'status' in answer ? readStorageAnswer(answer.status) : answer
  }
}

const sameServer: UploadRouteRequest = (route, init) =>
  api.fetchApi(route, init)

async function postJson(
  route: string,
  body: unknown,
  signal: AbortSignal,
  request: UploadRouteRequest = sameServer
) {
  return request(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
}

async function startFileUpload(
  file: File,
  options: ModelFileUploadOptions
): Promise<Response | undefined> {
  if (options.canStartTransfer?.() === false) return
  throwIfAborted(options.signal)
  const body = {
    filename: file.name,
    size_bytes: file.size,
    resumable: true,
    tags: options.tags,
    upload_analytics: { client: UPLOAD_CLIENT }
  } satisfies z.input<typeof zStartModelUploadBody>
  const response = await postJson(
    UPLOADS_ENDPOINT,
    body,
    options.signal,
    options.request
  )
  if (response.status !== 403) return response
  const refusal = zErrorResponse.safeParse(
    await response
      .clone()
      .json()
      .catch(() => null)
  )
  if (!refusal.success || refusal.data.code !== 'FEATURE_DISABLED')
    return response
  if (options.canStartTransfer?.() === false) return
  throwIfAborted(options.signal)
  return postJson(
    UPLOADS_ENDPOINT,
    { ...body, resumable: false },
    options.signal,
    options.request
  )
}

type TransferReport = z.input<typeof zReportModelUploadEventBody>

function transferReason({
  reason,
  cause
}: ModelFileUploadStopped): TransferReport['reason'] {
  if (reason === 'cancelled') return 'canceled'
  if (reason === 'sessionExpired') return 'session_expired'
  const status = typeof cause === 'string' && /^storage (\d+)$/.exec(cause)
  if (!status) return 'unknown'
  return status[1] === '0' ? 'network' : 'http'
}

function reportTransferStop(
  uploadId: string,
  report: TransferReport,
  request?: UploadRouteRequest
): void {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TRANSFER_REPORT_TIMEOUT_MS)
  void postJson(
    `${UPLOADS_ENDPOINT}/${encodeURIComponent(uploadId)}/events`,
    report,
    controller.signal,
    request
  )
    .catch(() => undefined)
    .finally(() => clearTimeout(timer))
}

export interface StagedModelFile {
  uploadId: string
  resumed?: boolean
}

async function readUploadStart(
  file: File,
  options: ModelFileUploadOptions
): Promise<
  z.output<typeof zStartModelUploadResponse> | ModelFileUploadStopped
> {
  const startRes = await startFileUpload(file, options)
  if (!startRes) return { ok: false, reason: 'featureDisabled' }
  if (!startRes.ok) return await readFailure(startRes)
  const start = zStartModelUploadResponse.safeParse(await startRes.json())
  if (!start.success) {
    return { ok: false, reason: 'failed', cause: start.error }
  }
  return start.data
}

async function stageFile(
  file: File,
  options: ModelFileUploadOptions
): Promise<StagedModelFile | ModelFileUploadStopped> {
  const signal =
    options.startTimeoutMs === undefined
      ? options.signal
      : combineAbortSignals([
          options.signal,
          createTimeoutSignal(options.startTimeoutMs)
        ])
  const start = await awaitWithAbort(
    readUploadStart(file, { ...options, signal }),
    signal
  )
  if ('ok' in start) return start

  const uploadId = start.upload_id
  const { stopped, resumed } =
    start.upload_mode === 'resumable'
      ? await putResumable(start, file, options)
      : await putOnce(start, file, options)
  if (!stopped) return { uploadId, resumed }
  if (start.upload_analytics_version === 1) {
    reportTransferStop(
      uploadId,
      {
        client: UPLOAD_CLIENT,
        size_bytes: file.size,
        model_folder: options.tags.find((tag) => tag !== 'models') ?? '',
        reason: transferReason(stopped),
        resumed
      },
      options.request
    )
  }
  return stopped
}

async function completeStagedFile(
  file: File,
  staged: StagedModelFile,
  { tags, signal, completionTimeoutMs, request }: ModelFileUploadOptions
): Promise<ModelFileUploadResult> {
  const completionSignal =
    completionTimeoutMs === undefined
      ? signal
      : combineAbortSignals([signal, createTimeoutSignal(completionTimeoutMs)])

  const completeRes = await postJson(
    `${UPLOADS_ENDPOINT}/${encodeURIComponent(staged.uploadId)}/complete`,
    {
      filename: file.name,
      tags,
      upload_analytics: { client: UPLOAD_CLIENT, resumed: staged.resumed }
    } satisfies z.input<typeof zCompleteModelUploadBody>,
    completionSignal,
    request
  )
  if (!completeRes.ok) return await readFailure(completeRes)
  const task = zCompleteModelUploadResponse.safeParse(await completeRes.json())
  if (!task.success) {
    return { ok: false, reason: 'failed', cause: task.error }
  }
  return { ok: true, taskId: task.data.task_id }
}

async function uploadModelFile(
  file: File,
  options: ModelFileUploadOptions
): Promise<ModelFileUploadResult> {
  const { signal } = options
  try {
    const staged = options.resumeFrom ?? (await stageFile(file, options))
    if ('ok' in staged) return staged
    if (signal.aborted) return { ok: false, reason: 'cancelled' }
    options.onCompleting?.(staged)
    return await completeStagedFile(file, staged, options)
  } catch (cause) {
    if (signal.aborted) return { ok: false, reason: 'cancelled' }
    if (cause instanceof ModelUploadRolloutDisabled)
      return { ok: false, reason: 'featureDisabled' }
    return { ok: false, reason: 'failed', cause }
  }
}

/** Sends a model file from the computer into the workspace library; never throws. */
export const modelFileUploadApi = { uploadModelFile }
