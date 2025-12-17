import { computed, reactive, readonly } from 'vue'

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
  ASSET_UPDATE_OPTIONS_ENABLED = 'asset_update_options_enabled',
  PRIVATE_MODELS_ENABLED = 'private_models_enabled',
  ONBOARDING_SURVEY_ENABLED = 'onboarding_survey_enabled'
}

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
    },
    get privateModelsEnabled() {
      // Check remote config first (from /api/features), fall back to websocket feature flags
      return (
        remoteConfig.value.private_models_enabled ??
        api.getServerFeature(ServerFeatureFlag.PRIVATE_MODELS_ENABLED, false)
      )
    },
    get onboardingSurveyEnabled() {
      return (
        remoteConfig.value.onboarding_survey_enabled ??
        api.getServerFeature(ServerFeatureFlag.ONBOARDING_SURVEY_ENABLED, true)
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
