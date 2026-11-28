import {
  awaitWithAbort,
  combineAbortSignals,
  createTimeoutSignal,
  throwIfAborted
} from '@comfyorg/api-client/abortSignal'
import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useEventListener } from '@vueuse/core'
import { delay } from 'es-toolkit'
import { readonly, shallowRef, watch } from 'vue'
import type { z } from 'zod'

import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'

const zOpenOnCloudRollout = zGetFeaturesResponse.pick({
  open_on_cloud_enabled: true,
  open_on_cloud_use_local_agent_enabled: true,
  open_on_cloud_model_upload_enabled: true
})

type OpenOnCloudRollout = z.infer<typeof zOpenOnCloudRollout>
type RolloutFailureKind =
  | 'network'
  | 'credential'
  | 'http'
  | 'parse'
  | 'unknown'
type RolloutAttempt =
  | { ok: true; data: OpenOnCloudRollout }
  | {
      ok: false
      retryable: boolean
      cause: unknown
      kind: RolloutFailureKind
      httpStatus?: number
    }

const rollout = shallowRef<OpenOnCloudRollout>()
export const UPLOAD_ROLLOUT_REFRESH_MS = 15_000
type RolloutSession = {
  getToken?: () => Promise<string | undefined>
  signal: AbortSignal
  latestRequest: number
  startupRetryPending: boolean
  revalidation?: Promise<boolean>
  transferGrantExpiresAt?: number
}
let currentSession: RolloutSession | undefined

export const localOpenOnCloudRollout = readonly(rollout)

function reportRolloutReadFailure(
  cause: unknown,
  kind: RolloutFailureKind,
  httpStatus?: number
): void {
  reportError(cause, {
    errorType: ['error_loading_open_on_cloud_rollout', kind, httpStatus]
      .filter((part) => part !== undefined)
      .join('_'),
    surface: 'platform',
    level: 'warning',
    sentryMode: 'once_per_page',
    tags: {
      outcome: 'degraded',
      failureKind: kind,
      ...(httpStatus !== undefined ? { httpStatus } : {})
    }
  })
}

async function parseRolloutResponse(
  response: Response
): Promise<RolloutAttempt> {
  try {
    const served = zOpenOnCloudRollout.safeParse(await response.json())
    if (served.success) return { ok: true, data: served.data }
    return {
      ok: false,
      retryable: false,
      cause: served.error,
      kind: 'parse'
    }
  } catch (cause) {
    return {
      ok: false,
      retryable: !(cause instanceof SyntaxError),
      cause,
      kind: 'parse'
    }
  }
}

async function requestRollout(
  endpoint: URL,
  getToken: RolloutSession['getToken'],
  signal: AbortSignal
): Promise<RolloutAttempt | undefined> {
  try {
    const requestSignal = combineAbortSignals([
      signal,
      createTimeoutSignal(5_000)
    ])
    throwIfAborted(requestSignal)
    const token = await (getToken && awaitWithAbort(getToken(), requestSignal))
    throwIfAborted(requestSignal)
    if (getToken && !token)
      return {
        ok: false,
        retryable: true,
        cause: new Error('Cloud rollout credential unavailable'),
        kind: 'credential'
      }
    let response: Response
    try {
      response = await fetch(endpoint, {
        cache: 'no-store',
        credentials: 'omit',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        redirect: 'error',
        signal: requestSignal
      })
    } catch (cause) {
      return { ok: false, retryable: true, cause, kind: 'network' }
    }
    if (!response.ok)
      return {
        ok: false,
        retryable: response.status === 429 || response.status >= 500,
        cause: new Error(`Cloud features HTTP ${response.status}`),
        kind: 'http',
        httpStatus: response.status
      }
    return await parseRolloutResponse(response)
  } catch (cause) {
    return { ok: false, retryable: true, cause, kind: 'unknown' }
  }
}

async function requestRolloutWithRetry(
  endpoint: URL,
  getToken: RolloutSession['getToken'],
  signal: AbortSignal
): Promise<RolloutAttempt | undefined> {
  let result = await requestRollout(endpoint, getToken, signal)
  for (const delayMs of [1_000, 1_000]) {
    if (result?.ok !== false || !result.retryable) break
    await delay(delayMs, { signal })
    result = await requestRollout(endpoint, getToken, signal)
  }
  return result
}

async function fetchRollout(
  getToken: RolloutSession['getToken'],
  signal: AbortSignal,
  retry: boolean
): Promise<RolloutAttempt | undefined> {
  try {
    const endpoint = new URL('/api/features', getBuildTimeComfyCloudBaseUrl())
    if (endpoint.protocol !== 'https:') return
    return await (retry ? requestRolloutWithRetry : requestRollout)(
      endpoint,
      getToken,
      signal
    )
  } catch (cause) {
    return { ok: false, retryable: false, cause, kind: 'unknown' }
  }
}

async function readRollout(
  session: RolloutSession,
  retry: boolean
): Promise<boolean> {
  const { getToken, signal } = session
  const request = ++session.latestRequest
  const result = await fetchRollout(getToken, signal, retry)
  if (signal.aborted || request !== session.latestRequest) return false
  if (result?.ok) {
    const enabled = result.data.open_on_cloud_enabled === true
    session.transferGrantExpiresAt =
      enabled && result.data.open_on_cloud_model_upload_enabled === true
        ? Date.now() + UPLOAD_ROLLOUT_REFRESH_MS
        : undefined
    rollout.value = result.data
    return enabled
  }
  session.transferGrantExpiresAt = undefined
  if (!result) return false
  if (!result.retryable) rollout.value = undefined
  if (retry) session.startupRetryPending = result.retryable
  reportRolloutReadFailure(result.cause, result.kind, result.httpStatus)
  return false
}

export function bindLocalOpenOnCloudGrant() {
  const session = currentSession
  const isCurrent = () => session !== undefined && currentSession === session
  async function revalidate() {
    if (!session || !isCurrent()) return false
    session.revalidation ??= readRollout(session, false).finally(() => {
      session.revalidation = undefined
    })
    return await session.revalidation
  }
  function hasModelUploadGrant() {
    return isCurrent() && Date.now() < (session?.transferGrantExpiresAt ?? 0)
  }
  return {
    isCurrent,
    revalidate,
    async allowsModelTransfer({ refresh = false } = {}) {
      if (!session || !isCurrent()) return false
      if (session.revalidation) await session.revalidation
      else if (refresh || !hasModelUploadGrant()) await revalidate()
      return hasModelUploadGrant()
    }
  }
}

export function startLocalOpenOnCloudRollout(
  getUserId: () => string | undefined,
  getToken: () => Promise<string | undefined>
): () => void {
  const stop = watch(
    getUserId,
    (userId, _, onCleanup) => {
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      currentSession = {
        getToken: userId ? getToken : undefined,
        signal: controller.signal,
        latestRequest: 0,
        startupRetryPending: false
      }
      rollout.value = undefined
      void readRollout(currentSession, true)
    },
    { immediate: true, flush: 'sync' }
  )
  const stopRecovery = useEventListener(window, ['online', 'focus'], () => {
    const session = currentSession
    if (session?.startupRetryPending) {
      session.startupRetryPending = false
      void readRollout(session, true)
    } else if (session?.getToken) {
      void bindLocalOpenOnCloudGrant().revalidate()
    }
  })
  return () => {
    stopRecovery()
    stop()
    currentSession = undefined
    rollout.value = undefined
  }
}
