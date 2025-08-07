import { computed, reactive, readonly } from 'vue'

import { api } from '@/scripts/api'

/**
 * Known server feature flags (top-level, not extensions)
 */
export enum ServerFeatureFlag {
  SUPPORTS_PREVIEW_METADATA = 'supports_preview_metadata',
  MAX_UPLOAD_SIZE = 'max_upload_size'
}

/**
 * Composable for reactive access to feature flags
 */
export function useFeatureFlags() {
  // Create reactive state that tracks server feature flags
  const flags = reactive({
    get supportsPreviewMetadata() {
      return api.getServerFeature(ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA)
    },
    get maxUploadSize() {
      return api.getServerFeature(ServerFeatureFlag.MAX_UPLOAD_SIZE)
    }
  })

  // Create a reactive computed for any feature flag
  const featureFlag = <T = unknown>(featurePath: string, defaultValue?: T) => {
    return computed(() => api.getServerFeature(featurePath, defaultValue))
  }

  return {
    flags: readonly(flags),
    featureFlag
  }
}
