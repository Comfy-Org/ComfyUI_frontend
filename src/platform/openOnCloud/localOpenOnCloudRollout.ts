import { combineAbortSignals } from '@comfyorg/api-client/abortSignal'
import { reportError } from '@comfyorg/telemetry/reportError'
import { delay } from 'es-toolkit'
import { readonly, shallowRef, watch } from 'vue'
import { z } from 'zod'

import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'

const zOpenOnCloudRollout = z.object({
  open_on_cloud_enabled: z.boolean(),
  open_on_cloud_use_local_agent_enabled: z.boolean().optional()
})

type OpenOnCloudRollout = z.infer<typeof zOpenOnCloudRollout>
type RolloutAttempt =
  | { ok: true; data: OpenOnCloudRollout }
  | { ok: false; retryable: boolean; cause: unknown }

const rollout = shallowRef<OpenOnCloudRollout>()
type RolloutSession = {
  getToken?: () => Promise<string | undefined>
  signal: AbortSignal
  latestRequest: number
  revalidation?: Promise<boolean>
}
let currentSession: RolloutSession | undefined

export const localOpenOnCloudRollout = readonly(rollout)

function reportRolloutReadFailure(cause: unknown): void {
  reportError(cause, {
    errorType: 'error_loading_open_on_cloud_rollout',
    surface: 'platform',
    level: 'warning',
    tags: { outcome: 'degraded' }
  })
}

async function requestRollout(
  endpoint: URL,
  getToken: () => Promise<string | undefined>,
  signal: AbortSignal
): Promise<RolloutAttempt | undefined> {
  try {
    const token = await getToken()
    if (signal.aborted) return
    if (!token)
      return {
        ok: false,
        retryable: true,
        cause: new Error('Cloud rollout credential unavailable')
      }
    const response = await fetch(endpoint, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: combineAbortSignals([signal, AbortSignal.timeout(5_000)])
    })
    if (!response.ok)
      return {
        ok: false,
        retryable: response.status === 429 || response.status >= 500,
        cause: new Error(`Cloud features HTTP ${response.status}`)
      }
    const served = zOpenOnCloudRollout.safeParse(
      await response.json().catch(() => undefined)
    )
    return served.success
      ? { ok: true, data: served.data }
      : {
          ok: false,
          retryable: false,
          cause: new Error('Invalid Cloud rollout response')
        }
  } catch (cause) {
    return { ok: false, retryable: true, cause }
  }
}

async function requestRolloutWithRetry(
  endpoint: URL,
  getToken: () => Promise<string | undefined>,
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
  getToken: () => Promise<string | undefined>,
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
    return { ok: false, retryable: false, cause }
  }
}

async function readRollout(
  session: RolloutSession,
  retry: boolean
): Promise<boolean> {
  const { getToken, signal } = session
  if (!getToken) return false
  const request = ++session.latestRequest
  const result = await fetchRollout(getToken, signal, retry)
  if (!result || signal.aborted || request !== session.latestRequest)
    return false
  if (result.ok) {
    rollout.value = result.data
    return result.data.open_on_cloud_enabled
  }
  if (!result.retryable) rollout.value = undefined
  reportRolloutReadFailure(result.cause)
  return false
}

export function bindLocalOpenOnCloudGrant() {
  const session = currentSession
  const isCurrent = () => currentSession === session
  return {
    isCurrent,
    async revalidate() {
      if (!session || !isCurrent()) return false
      const isSignedOut = !session.getToken
      if (isSignedOut) return true
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
        latestRequest: 0
      }
      rollout.value = undefined
      if (userId) void readRollout(currentSession, true)
    },
    { immediate: true, flush: 'sync' }
  )
  return () => {
    stop()
    currentSession = undefined
    rollout.value = undefined
  }
}
