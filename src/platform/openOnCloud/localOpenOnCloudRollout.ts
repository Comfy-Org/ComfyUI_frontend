import { readonly, ref } from 'vue'
import { z } from 'zod'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

const zOpenOnCloudRollout = z.object({ open_on_cloud_enabled: z.boolean() })
const enabled = ref<boolean>()

export const localOpenOnCloudRollout = readonly(enabled)

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
    const body: unknown = response.ok ? await response.json() : undefined
    enabled.value =
      zOpenOnCloudRollout.safeParse(body).data?.open_on_cloud_enabled
  } catch {
    enabled.value = undefined
  }
}
