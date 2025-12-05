import { computed, reactive, readonly, ref } from 'vue'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
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
 * Feature flag variant structure for experiments
 */
export interface FeatureFlagVariant {
  variant: string
  payload?: Record<string, unknown>
}

// Demo mode: allows manual override for demonstration
const demoOverrides = ref<Record<string, unknown>>({})

/**
 * Composable for reactive access to server-side feature flags
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
      // Check remote config first (from /api/features), fall back to websocket feature flags
      return (
        remoteConfig.value.model_upload_button_enabled ??
        api.getServerFeature(
          ServerFeatureFlag.MODEL_UPLOAD_BUTTON_ENABLED,
          false
        )
      )
    },
    get assetUpdateOptionsEnabled() {
      // Check remote config first (from /api/features), fall back to websocket feature flags
      return (
        remoteConfig.value.asset_update_options_enabled ??
        api.getServerFeature(
          ServerFeatureFlag.ASSET_UPDATE_OPTIONS_ENABLED,
          false
        )
      )
    }
  })

  const featureFlag = <T = unknown>(featurePath: string, defaultValue?: T) =>
    computed(() => {
      // Check demo overrides first
      if (demoOverrides.value[featurePath] !== undefined) {
        return demoOverrides.value[featurePath] as T
      }
      // Check remote config (from /api/features) - convert hyphens to underscores for lookup
      const remoteConfigKey = featurePath.replace(/-/g, '_')
      const remoteValue = (remoteConfig.value as Record<string, unknown>)[
        remoteConfigKey
      ]
      if (remoteValue !== undefined) {
        return remoteValue as T
      }
      // Fall back to server feature flags (WebSocket) - try both hyphen and underscore versions
      const wsValue = api.getServerFeature(featurePath, undefined)
      if (wsValue !== undefined) {
        return wsValue as T
      }
      // Try underscore version for WebSocket flags
      const wsValueUnderscore = api.getServerFeature(
        featurePath.replace(/-/g, '_'),
        undefined
      )
      if (wsValueUnderscore !== undefined) {
        return wsValueUnderscore as T
      }
      // Return default if nothing found
      return defaultValue as T
    })

  return {
    flags: readonly(flags),
    featureFlag
  }
}
