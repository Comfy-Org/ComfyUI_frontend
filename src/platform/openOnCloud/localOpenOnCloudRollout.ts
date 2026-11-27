import {
  combineAbortSignals,
  createTimeoutSignal
} from '@comfyorg/api-client/abortSignal'
import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useEventListener } from '@vueuse/core'
import { delay } from 'es-toolkit'
import { readonly, shallowRef, watch } from 'vue'
import { z } from 'zod'

import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'

const zOpenOnCloudRollout = zGetFeaturesResponse
  .pick({ open_on_cloud_enabled: true })
  .extend({ open_on_cloud_use_local_agent_enabled: z.boolean().optional() })

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
type RolloutSession = {
  getToken?: () => Promise<string | undefined>
  signal: AbortSignal
  latestRequest: number
  startupRetryPending: boolean
  revalidation?: Promise<boolean>
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
      cause: new Error('Invalid Cloud rollout response'),
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
    const token = await getToken?.()
    if (signal.aborted) return
    if (getToken && !token)
      return {
        ok: false,
        retryable: true,
        cause: new Error('Cloud rollout credential unavailable'),
        kind: 'credential'
      }
    const response = await fetchRolloutResponse(endpoint, token, signal)
    if (!(response instanceof Response)) return response
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

async function fetchRolloutResponse(
  endpoint: URL,
  token: string | undefined,
  signal: AbortSignal
): Promise<Response | RolloutAttempt> {
  try {
    return await fetch(endpoint, {
      cache: 'no-store',
      credentials: 'omit',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      redirect: 'error',
      signal: combineAbortSignals([signal, createTimeoutSignal(5_000)])
    })
  } catch (cause) {
    return { ok: false, retryable: true, cause, kind: 'network' }
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
  if (!result || signal.aborted || request !== session.latestRequest)
    return false
  if (result.ok) {
    rollout.value = result.data
    return result.data.open_on_cloud_enabled === true
  }
  if (!result.retryable) rollout.value = undefined
  if (retry) session.startupRetryPending = result.retryable
  reportRolloutReadFailure(result.cause, result.kind, result.httpStatus)
  return false
}

export function bindLocalOpenOnCloudGrant() {
  const session = currentSession
  const isCurrent = () => session !== undefined && currentSession === session
  return {
    isCurrent,
    async revalidate() {
      if (!session || !isCurrent()) return false
      session.revalidation ??= readRollout(session, false).finally(() => {
        session.revalidation = undefined
      })
      return await session.revalidation
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
    if (!session?.startupRetryPending) return
    session.startupRetryPending = false
    void readRollout(session, true)
  })
  return () => {
    stopRecovery()
    stop()
    currentSession = undefined
    rollout.value = undefined
  }
}
