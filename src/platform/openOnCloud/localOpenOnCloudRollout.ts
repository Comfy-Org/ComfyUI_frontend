import { combineAbortSignals } from '@comfyorg/api-client/abortSignal'
import { reportError } from '@comfyorg/telemetry/reportError'
import { readonly, shallowRef, watch } from 'vue'
import { z } from 'zod'

import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'

const zOpenOnCloudRollout = z.object({
  open_on_cloud_enabled: z.boolean(),
  open_on_cloud_use_local_agent_enabled: z.boolean().optional()
})

type OpenOnCloudRollout = z.infer<typeof zOpenOnCloudRollout>

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

async function readRollout(
  getToken: () => Promise<string | undefined>,
  signal: AbortSignal
): Promise<void> {
  try {
    const token = await getToken()
    if (!token) return

    const endpoint = new URL('/api/features', getBuildTimeComfyCloudBaseUrl())
    if (endpoint.protocol !== 'https:') return
    const response = await fetch(endpoint, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: combineAbortSignals([signal, AbortSignal.timeout(5_000)])
    })
    if (!response.ok) {
      reportRolloutReadFailure(
        new Error(`Cloud features HTTP ${response.status}`)
      )
      return
    }
    const served = zOpenOnCloudRollout.safeParse(await response.json())
    if (signal.aborted) return
    if (served.success) rollout.value = served.data
    else reportRolloutReadFailure(new Error('Invalid Cloud rollout response'))
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
