import { combineAbortSignals } from '@comfyorg/api-client/abortSignal'
import { reportError } from '@comfyorg/telemetry/reportError'
import { readonly, shallowRef, watch } from 'vue'
import { z } from 'zod'

import { getBuildTimeComfyCloudBaseUrl } from '@/config/comfyApi'
import { OPEN_ON_CLOUD_FEATURES_ACCEPT } from '@/platform/remoteConfig/serverFeatureFlag'

const zOpenOnCloudRollout = z.object({
  open_on_cloud_enabled: z.boolean().optional(),
  agent_consent_ingest_enabled: z.boolean().optional(),
  open_on_cloud_use_local_agent_enabled: z.boolean().optional()
})

type OpenOnCloudRollout = {
  publicEnabled?: boolean
  accountEnabled?: boolean
  localAgentEnabled?: boolean
}

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

function rolloutFromFeatures(
  features: z.infer<typeof zOpenOnCloudRollout>,
  authenticated: boolean
): OpenOnCloudRollout {
  const {
    open_on_cloud_enabled: enabled,
    agent_consent_ingest_enabled: consentIngestEnabled,
    open_on_cloud_use_local_agent_enabled: localAgentEnabled
  } = features
  return {
    publicEnabled: consentIngestEnabled === undefined ? undefined : enabled,
    accountEnabled: authenticated
      ? (consentIngestEnabled ?? enabled)
      : undefined,
    localAgentEnabled: authenticated ? localAgentEnabled : undefined
  }
}

async function readRollout(
  getToken: (() => Promise<string | undefined>) | undefined,
  signal: AbortSignal
): Promise<void> {
  try {
    const token = await getToken?.()
    signal.throwIfAborted()

    const endpoint = new URL('/api/features', getBuildTimeComfyCloudBaseUrl())
    if (endpoint.protocol !== 'https:') return
    const response = await fetch(endpoint, {
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Accept: OPEN_ON_CLOUD_FEATURES_ACCEPT,
        ...(token && { Authorization: `Bearer ${token}` })
      },
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
    signal.throwIfAborted()
    if (!served.success) {
      reportRolloutReadFailure(new Error('Invalid Cloud rollout response'))
      return
    }
    rollout.value = rolloutFromFeatures(served.data, Boolean(token))
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
      rollout.value = { publicEnabled: rollout.value?.publicEnabled }
      void readRollout(userId ? getToken : undefined, controller.signal)
    },
    { immediate: true, flush: 'sync' }
  )
  return () => {
    stop()
    rollout.value = undefined
  }
}
