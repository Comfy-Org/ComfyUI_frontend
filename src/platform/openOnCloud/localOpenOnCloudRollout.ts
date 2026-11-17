import { readonly, shallowRef, watch } from 'vue'
import { z } from 'zod'

import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'
import { reportError } from '@/platform/telemetry/reportError'
import { combineAbortSignals } from '@/utils/abortSignal'
import { sleep } from '@/utils/retryPolicy'

const zOpenOnCloudRollout = z.object({
  open_on_cloud_enabled: z.boolean(),
  open_on_cloud_use_local_agent_enabled: z.boolean().optional()
})

type OpenOnCloudRollout = z.infer<typeof zOpenOnCloudRollout>
type RolloutRead =
  | { ok: true; value: OpenOnCloudRollout }
  | { ok: false; retryable: boolean; cause: unknown }

const ROLLOUT_RETRY_DELAYS_MS = [500, 1_000]
const rollout = shallowRef<OpenOnCloudRollout>()

export const localOpenOnCloudRollout = readonly(rollout)

function reportRolloutReadFailure(cause: unknown): void {
  reportError(cause, {
    errorType: 'error_loading_open_on_cloud_rollout',
    surface: 'platform',
    level: 'warning',
    tags: { outcome: 'degraded' }
  })
}

async function fetchRollout(
  endpoint: URL,
  getToken: () => Promise<string | undefined>,
  signal: AbortSignal
): Promise<RolloutRead> {
  try {
    const token = await getToken()
    if (signal.aborted) {
      return { ok: false, retryable: false, cause: signal.reason }
    }
    if (!token) {
      return {
        ok: false,
        retryable: true,
        cause: new Error('Cloud rollout token unavailable')
      }
    }

    const response = await fetch(endpoint, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: combineAbortSignals([signal, AbortSignal.timeout(5_000)])
    })
    if (!response.ok) {
      return {
        ok: false,
        retryable: response.status >= 500,
        cause: new Error(`Cloud features HTTP ${response.status}`)
      }
    }
    const served = zOpenOnCloudRollout.safeParse(await response.json())
    return served.success
      ? { ok: true, value: served.data }
      : {
          ok: false,
          retryable: false,
          cause: new Error('Invalid Cloud rollout response')
        }
  } catch (cause) {
    return { ok: false, retryable: !(cause instanceof SyntaxError), cause }
  }
}

async function fetchRolloutWithRetry(
  endpoint: URL,
  getToken: () => Promise<string | undefined>,
  signal: AbortSignal
): Promise<RolloutRead> {
  let result = await fetchRollout(endpoint, getToken, signal)
  for (const delayMs of ROLLOUT_RETRY_DELAYS_MS) {
    if (result.ok || !result.retryable) break
    await sleep(delayMs, signal).catch(() => undefined)
    if (signal.aborted) break
    result = await fetchRollout(endpoint, getToken, signal)
  }
  return result
}

async function readRollout(
  getToken: () => Promise<string | undefined>,
  signal: AbortSignal
): Promise<void> {
  try {
    const endpoint = new URL('/api/features', getBuildTimeComfyCloudBaseUrl())
    if (endpoint.protocol !== 'https:') return
    const result = await fetchRolloutWithRetry(endpoint, getToken, signal)
    if (signal.aborted) return
    if (result.ok) rollout.value = result.value
    else reportRolloutReadFailure(result.cause)
  } catch (error) {
    if (!signal.aborted) reportRolloutReadFailure(error)
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
      rollout.value = undefined
      if (userId) void readRollout(getToken, controller.signal)
    },
    { immediate: true, flush: 'sync' }
  )
  return () => {
    stop()
    rollout.value = undefined
  }
}
