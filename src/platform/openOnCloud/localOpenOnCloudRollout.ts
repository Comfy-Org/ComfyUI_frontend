import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'
import { reportError } from '@comfyorg/telemetry/reportError'
import { readonly, ref } from 'vue'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

const zOpenOnCloudRollout = zGetFeaturesResponse.pick({
  open_on_cloud_enabled: true
})
const enabled = ref<boolean>()

export const localOpenOnCloudRollout = readonly(enabled)

function reportRolloutReadFailure(cause: unknown): void {
  reportError(cause, {
    errorType: 'error_loading_open_on_cloud_rollout',
    surface: 'platform',
    level: 'warning',
    tags: { outcome: 'degraded' }
  })
}

export async function refreshLocalOpenOnCloudRollout(): Promise<void> {
  if (remoteConfig.value.open_on_cloud_enabled !== undefined) return

  try {
    const response = await fetch(
      new URL('/api/features', getComfyCloudBaseUrl()),
      {
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(5_000)
      }
    )
    if (!response.ok) {
      reportRolloutReadFailure(
        new Error(`Cloud features HTTP ${response.status}`)
      )
      return
    }

    const rollout = zOpenOnCloudRollout.safeParse(await response.json())
    if (!rollout.success) {
      reportRolloutReadFailure(new Error('Invalid Cloud rollout response'))
      return
    }

    const value = rollout.data.open_on_cloud_enabled
    if (value !== undefined) enabled.value = value
  } catch (error) {
    reportRolloutReadFailure(error)
  }
}
