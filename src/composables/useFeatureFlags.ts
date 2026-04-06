import { computed, reactive, readonly } from 'vue'

import { isCloud, isNightly } from '@/platform/distribution/types'
import {
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { getServerCapability } from '@/services/serverCapabilities'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

/**
 * Known server feature flags (top-level, not extensions)
 */
export enum ServerFeatureFlag {
  SUPPORTS_PREVIEW_METADATA = 'supports_preview_metadata',
  MAX_UPLOAD_SIZE = 'max_upload_size',
  MANAGER_SUPPORTS_V4 = 'extension.manager.supports_v4',
  MODEL_UPLOAD_BUTTON_ENABLED = 'model_upload_button_enabled',
  ASSET_RENAME_ENABLED = 'asset_rename_enabled',
  PRIVATE_MODELS_ENABLED = 'private_models_enabled',
  ONBOARDING_SURVEY_ENABLED = 'onboarding_survey_enabled',
  LINEAR_TOGGLE_ENABLED = 'linear_toggle_enabled',
  TEAM_WORKSPACES_ENABLED = 'team_workspaces_enabled',
  USER_SECRETS_ENABLED = 'user_secrets_enabled',
  NODE_REPLACEMENTS = 'node_replacements',
  NODE_LIBRARY_ESSENTIALS_ENABLED = 'node_library_essentials_enabled',
  WORKFLOW_SHARING_ENABLED = 'workflow_sharing_enabled',
  COMFYHUB_UPLOAD_ENABLED = 'comfyhub_upload_enabled',
  COMFYHUB_PROFILE_GATE_ENABLED = 'comfyhub_profile_gate_enabled'
}

/**
 * Resolves a feature flag value with dev override > remoteConfig > serverCapability priority.
 */
function resolveFlag<T>(
  flagKey: string,
  remoteConfigValue: T | undefined,
  defaultValue: T
): T {
  const override = getDevOverride<T>(flagKey)
  if (override !== undefined) return override
  return remoteConfigValue ?? getServerCapability(flagKey, defaultValue)
}

/**
 * Composable for reactive access to feature flags
 */
export function useFeatureFlags() {
  const flags = reactive({
    // Direct server-only flags — resolved via getServerCapability() only
    get supportsPreviewMetadata() {
      return getServerCapability(
        ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA,
        false
      )
    },
    get maxUploadSize() {
      return getServerCapability(ServerFeatureFlag.MAX_UPLOAD_SIZE)
    },
    get supportsManagerV4() {
      return getServerCapability(ServerFeatureFlag.MANAGER_SUPPORTS_V4, false)
    },

    // Flags with remoteConfig override — resolved via resolveFlag()
    get modelUploadButtonEnabled() {
      return resolveFlag(
        ServerFeatureFlag.MODEL_UPLOAD_BUTTON_ENABLED,
        remoteConfig.value.model_upload_button_enabled,
        false
      )
    },
    get assetRenameEnabled() {
      return resolveFlag(
        ServerFeatureFlag.ASSET_RENAME_ENABLED,
        remoteConfig.value.asset_rename_enabled,
        false
      )
    },
    get privateModelsEnabled() {
      return resolveFlag(
        ServerFeatureFlag.PRIVATE_MODELS_ENABLED,
        remoteConfig.value.private_models_enabled,
        false
      )
    },
    get onboardingSurveyEnabled() {
      return resolveFlag(
        ServerFeatureFlag.ONBOARDING_SURVEY_ENABLED,
        remoteConfig.value.onboarding_survey_enabled,
        false
      )
    },
    // Flags with extra conditional logic (isNightly/isCloud guards)
    get linearToggleEnabled() {
      if (isNightly) return true

      return resolveFlag(
        ServerFeatureFlag.LINEAR_TOGGLE_ENABLED,
        remoteConfig.value.linear_toggle_enabled,
        false
      )
    },
    /**
     * Whether team workspaces feature is enabled.
     * IMPORTANT: Returns false until authenticated remote config is loaded.
     * This ensures we never use workspace tokens when the feature is disabled,
     * and prevents race conditions during initialization.
     */
    get teamWorkspacesEnabled() {
      const override = getDevOverride<boolean>(
        ServerFeatureFlag.TEAM_WORKSPACES_ENABLED
      )
      if (override !== undefined) return override

      if (!isCloud) return false
      if (!isAuthenticatedConfigLoaded.value) return false

      return (
        remoteConfig.value.team_workspaces_enabled ??
        getServerCapability(ServerFeatureFlag.TEAM_WORKSPACES_ENABLED, false)
      )
    },
    get userSecretsEnabled() {
      return resolveFlag(
        ServerFeatureFlag.USER_SECRETS_ENABLED,
        remoteConfig.value.user_secrets_enabled,
        false
      )
    },
    // Direct server-only flags with defaults
    get nodeReplacementsEnabled() {
      return getServerCapability(ServerFeatureFlag.NODE_REPLACEMENTS, false)
    },
    get nodeLibraryEssentialsEnabled() {
      if (isNightly || import.meta.env.DEV) return true

      return (
        remoteConfig.value.node_library_essentials_enabled ??
        getServerCapability(
          ServerFeatureFlag.NODE_LIBRARY_ESSENTIALS_ENABLED,
          false
        )
      )
    },
    get workflowSharingEnabled() {
      // UI is also gated on `isCloud` in TopMenuSection; default false
      // to match other flags' opt-in convention.
      return resolveFlag(
        ServerFeatureFlag.WORKFLOW_SHARING_ENABLED,
        remoteConfig.value.workflow_sharing_enabled,
        false
      )
    },
    get comfyHubUploadEnabled() {
      return resolveFlag(
        ServerFeatureFlag.COMFYHUB_UPLOAD_ENABLED,
        remoteConfig.value.comfyhub_upload_enabled,
        false
      )
    },
    get comfyHubProfileGateEnabled() {
      return resolveFlag(
        ServerFeatureFlag.COMFYHUB_PROFILE_GATE_ENABLED,
        remoteConfig.value.comfyhub_profile_gate_enabled,
        false
      )
    }
  })

  const featureFlag = <T = unknown>(featurePath: string, defaultValue?: T) =>
    computed(() => getServerCapability(featurePath, defaultValue))

  return {
    flags: readonly(flags),
    featureFlag
  }
}
