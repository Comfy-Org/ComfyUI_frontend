import { ComfyApi as ComfyApiClient } from '@comfyorg/api-client/ComfyApi'
import type { FreeMemoryResult } from '@comfyorg/api-client/ComfyApi'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

function featureFlagOverride<T>(
  featureName: string & { readonly valueType?: T }
): T | undefined {
  const sessionOverride = getSessionOverride<T>(featureName)
  return sessionOverride !== undefined
    ? sessionOverride
    : getDevOverride<T>(featureName)
}

function notifyFreeMemory(result: FreeMemoryResult): void {
  const toast = useToast()
  if (result.ok) {
    toast.success(
      t(
        result.freedExecutionCache
          ? 'toastMessages.modelsAndCacheCleared'
          : 'toastMessages.modelsUnloaded'
      ),
      { duration: 3000 }
    )
    return
  }
  toast.error(
    t(
      result.reason === 'rejected'
        ? 'toastMessages.unloadModelsFailed'
        : 'toastMessages.unloadModelsError'
    )
  )
}

export const ComfyApi = ComfyApiClient

export const api = new ComfyApi({
  get isCloud() {
    return isCloud
  },
  featureFlagOverride,
  onFreeMemory: notifyFreeMemory
})
