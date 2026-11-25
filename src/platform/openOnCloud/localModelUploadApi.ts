import {
  awaitWithAbort,
  combineAbortSignals,
  createTimeoutSignal,
  throwIfAborted
} from '@comfyorg/api-client/abortSignal'
import { zGetModelsInFolderResponse } from '@comfyorg/comfyui-api-types'
import {
  zGetFeaturesResponse,
  zGetTaskResponse
} from '@comfyorg/ingest-types/zod'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'
import { bindLocalOpenOnCloudGrant } from '@/platform/openOnCloud/localOpenOnCloudRollout'
import {
  ModelUploadRolloutDisabled,
  UPLOADS_ENDPOINT
} from '@/platform/assets/services/modelFileUploadApi'
import type { UploadRouteRequest } from '@/platform/assets/services/modelFileUploadApi'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'

const TASK_POLL_MS = 2_000
const READ_TIMEOUT_MS = 10_000
const STORE_DEADLINE_MS = 30 * 60_000

const zUploadFolders = zGetFeaturesResponse.pick({
  model_upload_folders: true
})

async function cloudHeaders(
  headers?: HeadersInit,
  expectedWorkspaceId?: string,
  signal?: AbortSignal
): Promise<Headers | undefined> {
  throwIfAborted(signal)
  const { headers: auth, workspaceId } = await awaitWithAbort(
    useAuthStore().getWorkspaceAuthContext(),
    signal
  )
  if (
    !auth ||
    !workspaceId ||
    (expectedWorkspaceId && workspaceId !== expectedWorkspaceId)
  )
    return
  const merged = new Headers(headers)
  for (const [name, value] of Object.entries(auth)) merged.set(name, value)
  return merged
}

function cloudUploadUrl(route: string): string | undefined {
  try {
    const base = new URL(getBuildTimeComfyCloudBaseUrl())
    if (base.protocol === 'https:')
      return new URL(`/api${route}`, base.origin).href
  } catch {
    return undefined
  }
}

/** Sends an upload route to Comfy Cloud as the signed-in workspace. */
export async function cloudUploadRequest(
  route: string,
  init: RequestInit,
  workspaceId?: string
): Promise<Response> {
  const url = cloudUploadUrl(route)
  if (!url) return new Response(null, { status: 503 })
  const signal = init.signal ?? undefined
  const headers = await cloudHeaders(init.headers, workspaceId, signal)
  if (!headers) return new Response(null, { status: 401 })
  if (route === UPLOADS_ENDPOINT) {
    const grant = bindLocalOpenOnCloudGrant()
    const enabled = await awaitWithAbort(
      grant.allowsModelTransfer({ refresh: true }),
      signal
    )
    if (
      !enabled ||
      !grant.isCurrent() ||
      !useFeatureFlags().flags.openOnCloudModelUploadEnabled
    )
      throw new ModelUploadRolloutDisabled()
  }
  throwIfAborted(signal)
  return fetch(url, { ...init, headers, redirect: 'error' })
}

/** The model folders Comfy Cloud takes uploads into; empty when it takes none. */
export async function readCloudUploadFolders(): Promise<string[]> {
  try {
    const url = cloudUploadUrl('/features')
    if (!url) return []
    const signal = createTimeoutSignal(READ_TIMEOUT_MS)
    const headers = await cloudHeaders(undefined, undefined, signal)
    if (!headers) return []
    const response = await fetch(url, {
      cache: 'no-store',
      headers,
      redirect: 'error',
      signal
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
      `/experiment/models/${encodeURIComponent(folder)}`,
      { signal: createTimeoutSignal(READ_TIMEOUT_MS) }
    )
    if (!response.ok) return new Map()
    const files = zGetModelsInFolderResponse.safeParse(await response.json())
    if (!files.success) return new Map()
    const firstSizeByName = new Map<string, number>()
    for (const file of files.data) {
      const name = file.name.replaceAll('\\', '/')
      if (!firstSizeByName.has(name)) firstSizeByName.set(name, file.size)
    }
    return firstSizeByName
  } catch {
    return new Map()
  }
}

export type StoredTaskOutcome =
  | { ok: true }
  | {
      ok: false
      reason: 'cancelled' | 'failed' | 'storagePending' | 'taskUnavailable'
      message?: string
    }

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

async function readTaskOutcome(
  response: Response,
  signal: AbortSignal
): Promise<StoredTaskOutcome | undefined> {
  if (response.status >= 500 || response.status === 429) return
  if (response.status === 404) return { ok: false, reason: 'taskUnavailable' }
  if (!response.ok) return { ok: false, reason: 'storagePending' }
  const task = zGetTaskResponse.safeParse(await response.json())
  if (signal.aborted) return
  if (!task.success) return { ok: false, reason: 'storagePending' }
  if (task.data.status === 'failed')
    return { ok: false, reason: 'failed', message: task.data.error_message }
  return TASK_OUTCOMES[task.data.status]
}

async function readStoredTask(
  taskId: string,
  signal: AbortSignal,
  request: UploadRouteRequest
): Promise<StoredTaskOutcome | undefined> {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), READ_TIMEOUT_MS)
  const pollSignal = combineAbortSignals([signal, timeout.signal])
  let response: Response | undefined
  try {
    response = await request(`/tasks/${encodeURIComponent(taskId)}`, {
      signal: pollSignal
    })
    return await readTaskOutcome(response, pollSignal)
  } catch {
    if (!response || pollSignal.aborted) return
    return { ok: false, reason: 'storagePending' }
  } finally {
    clearTimeout(timer)
  }
}

/** Polls the Comfy Cloud task that stores an uploaded file until it ends. */
export async function waitForStoredModel(
  taskId: string,
  signal: AbortSignal,
  request: UploadRouteRequest = cloudUploadRequest
): Promise<StoredTaskOutcome> {
  const deadline = Date.now() + STORE_DEADLINE_MS
  while (await wait(TASK_POLL_MS, signal)) {
    const outcome = await readStoredTask(taskId, signal, request)
    if (signal.aborted) break
    if (outcome) return outcome
    if (Date.now() >= deadline) return { ok: false, reason: 'storagePending' }
  }
  return { ok: false, reason: 'cancelled' }
}
