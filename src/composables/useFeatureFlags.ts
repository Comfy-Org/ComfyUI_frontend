import { computed, reactive, readonly } from 'vue'

import { isCloud, isNightly } from '@/platform/distribution/types'
import {
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'

/**
 * Known server feature flags (top-level, not extensions)
 */
export enum ServerFeatureFlag {
  SUPPORTS_PREVIEW_METADATA = 'supports_preview_metadata',
  MAX_UPLOAD_SIZE = 'max_upload_size',
  MANAGER_SUPPORTS_V4 = 'extension.manager.supports_v4',
  MODEL_UPLOAD_BUTTON_ENABLED = 'model_upload_button_enabled',
  ASSET_DELETION_ENABLED = 'asset_deletion_enabled',
  ASSET_RENAME_ENABLED = 'asset_rename_enabled',
  PRIVATE_MODELS_ENABLED = 'private_models_enabled',
  ONBOARDING_SURVEY_ENABLED = 'onboarding_survey_enabled',
  HUGGINGFACE_MODEL_IMPORT_ENABLED = 'huggingface_model_import_enabled',
  LINEAR_TOGGLE_ENABLED = 'linear_toggle_enabled',
  ASYNC_MODEL_UPLOAD_ENABLED = 'async_model_upload_enabled',
  TEAM_WORKSPACES_ENABLED = 'team_workspaces_enabled'
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
    get assetDeletionEnabled() {
      return (
        remoteConfig.value.asset_deletion_enabled ??
        api.getServerFeature(ServerFeatureFlag.ASSET_DELETION_ENABLED, false)
      )
    },
    get assetRenameEnabled() {
      return (
        remoteConfig.value.asset_rename_enabled ??
        api.getServerFeature(ServerFeatureFlag.ASSET_RENAME_ENABLED, false)
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
    },
    get huggingfaceModelImportEnabled() {
      return (
        remoteConfig.value.huggingface_model_import_enabled ??
        api.getServerFeature(
          ServerFeatureFlag.HUGGINGFACE_MODEL_IMPORT_ENABLED,
          false
        )
      )
    },
    get linearToggleEnabled() {
      if (isNightly) return true

      return (
        remoteConfig.value.linear_toggle_enabled ??
        api.getServerFeature(ServerFeatureFlag.LINEAR_TOGGLE_ENABLED, false)
      )
    },
    get asyncModelUploadEnabled() {
      return (
        remoteConfig.value.async_model_upload_enabled ??
        api.getServerFeature(
          ServerFeatureFlag.ASYNC_MODEL_UPLOAD_ENABLED,
          false
        )
      )
    },
    /**
     * Whether team workspaces feature is enabled.
     * IMPORTANT: Returns false until authenticated remote config is loaded.
     * This ensures we never use workspace tokens when the feature is disabled,
     * and prevents race conditions during initialization.
     */
    get teamWorkspacesEnabled() {
      if (!isCloud) return false

      // Only return true if authenticated config has been loaded.
      // This prevents race conditions where code checks this flag before
      // WorkspaceAuthGate has refreshed the config with auth.
      if (!isAuthenticatedConfigLoaded.value) return false

      return (
        remoteConfig.value.team_workspaces_enabled ??
        api.getServerFeature(ServerFeatureFlag.TEAM_WORKSPACES_ENABLED, false)
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
