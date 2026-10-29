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

type ModelFileUploadFailure =
  | 'unsupportedFile'
  | 'unsupportedType'
  | 'tooLarge'
  | 'cancelled'
  | 'failed'

/** The outcome of sending one model file: the server task that stores it, or why it stopped. */
export type ModelFileUploadResult =
  | { ok: true; taskId: string }
  | {
      ok: false
      reason: ModelFileUploadFailure
      message?: string
      cause?: unknown
    }

interface ModelFileUploadOptions {
  tags: string[]
  signal: AbortSignal
  onProgress: (sentBytes: number) => void
}

async function readFailure(
  res: Response
): Promise<Extract<ModelFileUploadResult, { ok: false }>> {
  const body = zErrorResponse.safeParse(await res.json().catch(() => null))
  const code = body.success ? body.data.code : undefined
  if (code === 'UNSUPPORTED_FILE_TYPE') {
    return { ok: false, reason: 'unsupportedFile' }
  }
  if (code === 'UNSUPPORTED_MODEL_TYPE') {
    return { ok: false, reason: 'unsupportedType' }
  }
  if (code === 'FILE_TOO_LARGE' && body.success) {
    return { ok: false, reason: 'tooLarge', message: body.data.message }
  }
  return { ok: false, reason: 'failed', cause: `${res.status} ${code ?? ''}` }
}

function putFile(
  start: Pick<ModelUploadStarted, 'method' | 'upload_url' | 'headers'>,
  file: File,
  { signal, onProgress }: ModelFileUploadOptions
): Promise<ModelFileUploadResult | undefined> {
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
    request.onload = () =>
      resolve(
        request.status >= 200 && request.status < 300
          ? undefined
          : { ok: false, reason: 'failed', cause: `storage ${request.status}` }
      )
    request.onerror = () =>
      resolve({ ok: false, reason: 'failed', cause: 'storage network error' })
    request.onabort = () => resolve({ ok: false, reason: 'cancelled' })
    const abort = () => request.abort()
    request.onloadend = () => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort, { once: true })
    request.send(file)
  })
}

async function postJson(route: string, body: unknown, signal: AbortSignal) {
  return api.fetchApi(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
}

/**
 * Sends a model file from the computer into the workspace library: asks for a
 * signed upload URL, puts the bytes straight to storage, then asks the server
 * to store it. Never throws.
 */
async function uploadModelFile(
  file: File,
  options: ModelFileUploadOptions
): Promise<ModelFileUploadResult> {
  const { tags, signal } = options
  try {
    const startRes = await postJson(
      UPLOADS_ENDPOINT,
      {
        filename: file.name,
        size_bytes: file.size,
        tags
      } satisfies StartModelUploadData['body'],
      signal
    )
    if (!startRes.ok) return await readFailure(startRes)
    const start = zStartModelUploadResponse.safeParse(await startRes.json())
    if (!start.success) {
      return { ok: false, reason: 'failed', cause: start.error }
    }

    const sent = await putFile(start.data, file, options)
    if (sent) return sent

    const completeRes = await postJson(
      `${UPLOADS_ENDPOINT}/${encodeURIComponent(start.data.upload_id)}/complete`,
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

export const modelFileUploadApi = { uploadModelFile }
