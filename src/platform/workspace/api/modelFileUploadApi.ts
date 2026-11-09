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

const UPLOADS_ENDPOINT = '/assets/uploads'
const STORAGE_OBJECT_ALREADY_WRITTEN = 412
const UPLOAD_CLIENT = 'editor'
const TRANSFER_REPORT_TIMEOUT_MS = 5_000

type ModelFileUploadFailure =
  | 'unsupportedFile'
  | 'unsupportedType'
  | 'tooLarge'
  | 'privateModelsDisabled'
  | 'planUnavailable'
  | 'sessionExpired'
  | 'cancelled'
  | 'failed'

const FAILURE_BY_CODE: Partial<Record<string, ModelFileUploadFailure>> = {
  UNSUPPORTED_FILE_TYPE: 'unsupportedFile',
  UNSUPPORTED_MODEL_TYPE: 'unsupportedType',
  PRIVATE_MODELS_DISABLED: 'privateModelsDisabled',
  PRIVATE_MODELS_UNAVAILABLE: 'planUnavailable'
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

interface ModelFileUploadOptions {
  tags: string[]
  signal: AbortSignal
  onProgress: (sentBytes: number) => void
  onReconnecting?: (reconnecting: boolean) => void
}

async function readFailure(res: Response): Promise<ModelFileUploadStopped> {
  const body = zErrorResponse.safeParse(await res.json().catch(() => null))
  const code = body.success ? body.data.code : undefined
  const reason = code ? FAILURE_BY_CODE[code] : undefined
  if (reason) return { ok: false, reason }
  if (code === 'FILE_TOO_LARGE' && body.success) {
    return { ok: false, reason: 'tooLarge', message: body.data.message }
  }
  return { ok: false, reason: 'failed', cause: `${res.status} ${code ?? ''}` }
}

interface StorageAnswer {
  status: number
  range: string | null
}

function putFile(
  start: Pick<
    ReturnType<typeof zStartModelUploadResponse.parse>,
    'method' | 'upload_url' | 'headers'
  >,
  file: Blob | null,
  { signal, onProgress }: ModelFileUploadOptions,
  contentRange?: string
): Promise<StorageAnswer | ModelFileUploadStopped> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve({ ok: false, reason: 'cancelled' })
      return
    }
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

/** `resumed` is absent when the transfer could not observe a recovery. */
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

async function postJson(route: string, body: unknown, signal: AbortSignal) {
  return api.fetchApi(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
}

async function startFileUpload(
  file: File,
  options: ModelFileUploadOptions
): Promise<Response> {
  const body = {
    filename: file.name,
    size_bytes: file.size,
    resumable: true,
    tags: options.tags,
    upload_analytics: { client: UPLOAD_CLIENT }
  } satisfies z.input<typeof zStartModelUploadBody>
  const response = await postJson(UPLOADS_ENDPOINT, body, options.signal)
  if (response.status !== 403) return response
  const refusal = zErrorResponse.safeParse(
    await response
      .clone()
      .json()
      .catch(() => null)
  )
  if (!refusal.success || refusal.data.code !== 'FEATURE_DISABLED')
    return response
  return postJson(
    UPLOADS_ENDPOINT,
    { ...body, resumable: false },
    options.signal
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

/** Best effort: it never throws, and the caller never waits for it. */
function reportTransferStop(uploadId: string, report: TransferReport): void {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TRANSFER_REPORT_TIMEOUT_MS)
  void postJson(
    `${UPLOADS_ENDPOINT}/${encodeURIComponent(uploadId)}/events`,
    report,
    controller.signal
  )
    .catch(() => undefined)
    .finally(() => clearTimeout(timer))
}

interface StagedFile {
  uploadId: string
  resumed?: boolean
}

async function stageFile(
  file: File,
  options: ModelFileUploadOptions
): Promise<StagedFile | ModelFileUploadStopped> {
  const startRes = await startFileUpload(file, options)
  if (!startRes.ok) return await readFailure(startRes)
  const start = zStartModelUploadResponse.safeParse(await startRes.json())
  if (!start.success) {
    return { ok: false, reason: 'failed', cause: start.error }
  }
  const uploadId = start.data.upload_id
  const { stopped, resumed } =
    start.data.upload_mode === 'resumable'
      ? await putResumable(start.data, file, options)
      : await putOnce(start.data, file, options)
  if (!stopped) return { uploadId, resumed }
  if (start.data.upload_analytics_version === 1) {
    reportTransferStop(uploadId, {
      client: UPLOAD_CLIENT,
      size_bytes: file.size,
      model_folder: options.tags.find((tag) => tag !== 'models') ?? '',
      reason: transferReason(stopped),
      resumed
    })
  }
  return stopped
}

async function uploadModelFile(
  file: File,
  options: ModelFileUploadOptions
): Promise<ModelFileUploadResult> {
  const { tags, signal } = options
  try {
    const staged = await stageFile(file, options)
    if ('ok' in staged) return staged

    const completeRes = await postJson(
      `${UPLOADS_ENDPOINT}/${encodeURIComponent(staged.uploadId)}/complete`,
      {
        filename: file.name,
        tags,
        upload_analytics: { client: UPLOAD_CLIENT, resumed: staged.resumed }
      } satisfies z.input<typeof zCompleteModelUploadBody>,
      signal
    )
    if (!completeRes.ok) return await readFailure(completeRes)
    const task = zCompleteModelUploadResponse.safeParse(
      await completeRes.json()
    )
    if (!task.success) {
      return { ok: false, reason: 'failed', cause: task.error }
    }
    return { ok: true, taskId: task.data.task_id }
  } catch (cause) {
    return signal.aborted
      ? { ok: false, reason: 'cancelled' }
      : { ok: false, reason: 'failed', cause }
  }
}

/** Sends a model file from the computer into the workspace library; never throws. */
export const modelFileUploadApi = { uploadModelFile }
