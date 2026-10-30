import type {
  CompleteModelUploadData,
  ModelUploadStarted,
  StartModelUploadData
} from '@comfyorg/ingest-types'
import {
  zCompleteModelUploadResponse,
  zErrorResponse,
  zStartModelUploadResponse
} from '@comfyorg/ingest-types/zod'

import { api } from '@/scripts/api'

const UPLOADS_ENDPOINT = '/assets/uploads'
const STORAGE_OBJECT_ALREADY_WRITTEN = 412

type ModelFileUploadFailure =
  | 'unsupportedFile'
  | 'unsupportedType'
  | 'tooLarge'
  | 'privateModelsDisabled'
  | 'planUnavailable'
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

function putFile(
  start: Pick<ModelUploadStarted, 'method' | 'upload_url' | 'headers'>,
  file: File,
  { signal, onProgress }: ModelFileUploadOptions
): Promise<ModelFileUploadStopped | undefined> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve({ ok: false, reason: 'cancelled' })
      return
    }
    const request = new XMLHttpRequest()
    request.open(start.method, start.upload_url)
    for (const [name, value] of Object.entries(start.headers)) {
      request.setRequestHeader(name, value)
    }
    request.upload.onprogress = (event) => onProgress(event.loaded)
    request.onload = () => resolve(readStorageAnswer(request.status))
    request.onerror = () =>
      resolve({ ok: false, reason: 'failed', cause: 'storage network error' })
    request.onabort = () => resolve({ ok: false, reason: 'cancelled' })
    const abort = () => request.abort()
    request.onloadend = () => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort, { once: true })
    request.send(file)
  })
}

function readStorageAnswer(status: number): ModelFileUploadStopped | undefined {
  if (status >= 200 && status < 300) return undefined
  if (status === STORAGE_OBJECT_ALREADY_WRITTEN) return undefined
  return { ok: false, reason: 'failed', cause: `storage ${status}` }
}

async function postJson(route: string, body: unknown, signal: AbortSignal) {
  return api.fetchApi(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
}

async function stageFile(
  file: File,
  options: ModelFileUploadOptions
): Promise<string | ModelFileUploadStopped> {
  const startRes = await postJson(
    UPLOADS_ENDPOINT,
    {
      filename: file.name,
      size_bytes: file.size,
      tags: options.tags
    } satisfies StartModelUploadData['body'],
    options.signal
  )
  if (!startRes.ok) return await readFailure(startRes)
  const start = zStartModelUploadResponse.safeParse(await startRes.json())
  if (!start.success) {
    return { ok: false, reason: 'failed', cause: start.error }
  }
  return (await putFile(start.data, file, options)) ?? start.data.upload_id
}

async function uploadModelFile(
  file: File,
  options: ModelFileUploadOptions
): Promise<ModelFileUploadResult> {
  const { tags, signal } = options
  try {
    const staged = await stageFile(file, options)
    if (typeof staged !== 'string') return staged

    const completeRes = await postJson(
      `${UPLOADS_ENDPOINT}/${encodeURIComponent(staged)}/complete`,
      { filename: file.name, tags } satisfies CompleteModelUploadData['body'],
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
