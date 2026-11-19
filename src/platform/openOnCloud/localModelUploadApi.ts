import { zGetTaskResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { ingestApiUrl } from '@/platform/remote/ingest/ingestApiUrl'
import type { UploadRouteRequest } from '@/platform/workspace/api/modelFileUploadApi'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'

const TASK_POLL_MS = 2_000
const READ_TIMEOUT_MS = 10_000

const zUploadFolders = z.object({
  model_upload_folders: z.array(z.string()).optional()
})
const zLocalModelFiles = z.array(
  z.object({ name: z.string(), size: z.number() })
)

async function cloudHeaders(headers?: HeadersInit): Promise<Headers> {
  const merged = new Headers(headers)
  const auth = await useAuthStore().getWorkspaceAuthHeader()
  for (const [name, value] of Object.entries(auth ?? {}))
    merged.set(name, value)
  return merged
}

/** Sends an upload route to Comfy Cloud as the signed-in workspace. */
export const cloudUploadRequest: UploadRouteRequest = async (route, init) =>
  fetch(ingestApiUrl(route), {
    ...init,
    headers: await cloudHeaders(init.headers)
  })

/** The model folders Comfy Cloud takes uploads into; empty when it takes none. */
export async function readCloudUploadFolders(): Promise<string[]> {
  try {
    const response = await fetch(ingestApiUrl('/features'), {
      cache: 'no-store',
      headers: await cloudHeaders(),
      signal: AbortSignal.timeout(READ_TIMEOUT_MS)
    })
    if (!response.ok) return []
    const body = zUploadFolders.safeParse(await response.json())
    return body.success ? (body.data.model_upload_folders ?? []) : []
  } catch {
    return []
  }
}

/** Each model file's size in a local model folder, by its name there. */
export async function readLocalModelSizes(
  folder: string
): Promise<Map<string, number>> {
  try {
    const response = await api.fetchApi(
      `/experiment/models/${encodeURIComponent(folder)}`
    )
    if (!response.ok) return new Map()
    const files = zLocalModelFiles.safeParse(await response.json())
    if (!files.success) return new Map()
    return new Map(
      files.data.map((file) => [file.name.replaceAll('\\', '/'), file.size])
    )
  } catch {
    return new Map()
  }
}

export type StoredTaskOutcome =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'failed'; message?: string }

function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve(!signal.aborted)
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}

const TASK_OUTCOMES: Partial<Record<string, StoredTaskOutcome>> = {
  completed: { ok: true },
  cancelled: { ok: false, reason: 'cancelled' }
}

async function taskAnswer(
  taskId: string,
  signal: AbortSignal
): Promise<Response | null> {
  try {
    return await cloudUploadRequest(`/tasks/${encodeURIComponent(taskId)}`, {
      signal
    })
  } catch {
    return null
  }
}

async function readStoredTask(
  taskId: string,
  signal: AbortSignal
): Promise<StoredTaskOutcome | undefined> {
  const response = await taskAnswer(taskId, signal)
  if (!response || response.status >= 500 || response.status === 429)
    return undefined
  const task = response.ok
    ? zGetTaskResponse.safeParse(await response.json())
    : null
  if (!task?.success) return { ok: false, reason: 'failed' }
  if (task.data.status === 'failed')
    return { ok: false, reason: 'failed', message: task.data.error_message }
  return TASK_OUTCOMES[task.data.status]
}

/** Polls the Comfy Cloud task that stores an uploaded file until it ends. */
export async function waitForStoredModel(
  taskId: string,
  signal: AbortSignal
): Promise<StoredTaskOutcome> {
  while (await wait(TASK_POLL_MS, signal)) {
    const outcome = await readStoredTask(taskId, signal)
    if (outcome) return outcome
  }
  return { ok: false, reason: 'cancelled' }
}
