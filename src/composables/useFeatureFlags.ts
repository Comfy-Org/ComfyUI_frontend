import { computed, reactive, readonly } from 'vue'

import { api } from '@/scripts/api'

/**
 * Known server feature flags (top-level, not extensions)
 */
export enum ServerFeatureFlag {
  SUPPORTS_PREVIEW_METADATA = 'supports_preview_metadata',
  MAX_UPLOAD_SIZE = 'max_upload_size',
  MANAGER_SUPPORTS_V4 = 'extension.manager.supports_v4',
  MODEL_UPLOAD_BUTTON_ENABLED = 'model_upload_button_enabled',
  ASSET_UPDATE_OPTIONS_ENABLED = 'asset_update_options_enabled'
}

/**
 * Provides reactive accessors for server-side feature flags.
 *
 * Exposes a readonly `flags` object containing convenience getters for known server feature keys
 * and a `featureFlag` helper that returns a computed value for an arbitrary feature path,
 * optionally using a supplied default when the feature is not present.
 *
 * @returns An object with:
 *  - `flags`: a readonly reactive object with predefined getters for common server feature flags
 *  - `featureFlag`: a generic function `(featurePath: string, defaultValue?) => ComputedRef<T>` that yields a computed feature value
 */
export function useFeatureFlags() {
  const flags = reactive({
    get supportsPreviewMetadata() {
      return api.getServerFeature(ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA)
    },
    get maxUploadSize() {
      return api.getServerFeature(ServerFeatureFlag.MAX_UPLOAD_SIZE)
    },
    get supportsManagerV4() {
      return api.getServerFeature(ServerFeatureFlag.MANAGER_SUPPORTS_V4)
    },
    get modelUploadButtonEnabled() {
      return api.getServerFeature(
        ServerFeatureFlag.MODEL_UPLOAD_BUTTON_ENABLED,
        false
      )
    },
    get assetUpdateOptionsEnabled() {
      return api.getServerFeature(
        ServerFeatureFlag.ASSET_UPDATE_OPTIONS_ENABLED,
        false
      )
    }
  })

  const featureFlag = <T = unknown>(featurePath: string, defaultValue?: T) =>
    computed(() => api.getServerFeature(featurePath, defaultValue))

  return {
    flags: readonly(flags),
    featureFlag
  }
}
