import { computed, reactive, readonly } from 'vue'
import type { Ref } from 'vue'

import { isCloud, isNightly } from '@/platform/distribution/types'
import {
  cachedBillingControlEnabled,
  cachedTeamWorkspacesEnabled,
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'
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
  PARTNER_NODE_GOVERNANCE_ENABLED = 'partner_node_governance_enabled',
  USER_SECRETS_ENABLED = 'user_secrets_enabled',
  NODE_REPLACEMENTS = 'node_replacements',
  NODE_LIBRARY_ESSENTIALS_ENABLED = 'node_library_essentials_enabled',
  WORKFLOW_SHARING_ENABLED = 'workflow_sharing_enabled',
  COMFYHUB_UPLOAD_ENABLED = 'comfyhub_upload_enabled',
  COMFYHUB_PROFILE_GATE_ENABLED = 'comfyhub_profile_gate_enabled',
  SHOW_SIGNIN_BUTTON = 'show_signin_button',
  UNIFIED_CLOUD_AUTH = 'unified_cloud_auth',
  BILLING_CONTROL_ENABLED = 'billing_control_enabled',
  FREE_TIER_JOB_ALLOWANCE_ENABLED = 'free_tier_job_allowance_enabled',
  SIGNUP_TURNSTILE = 'signup_turnstile'
}

/**
 * Resolves a feature flag value with dev override > remoteConfig > serverFeature priority.
 */
function resolveFlag<T>(
  flagKey: string,
  remoteConfigValue: T | undefined,
  defaultValue: T
): T {
  const override = getDevOverride<T>(flagKey)
  if (override !== undefined) return override
  return remoteConfigValue ?? api.getServerFeature(flagKey, defaultValue)
}

/**
 * Resolves a per-user, Cloud-only flag that selects backend behavior. Off the
 * Cloud build it is always false; during the auth window it falls back to the
 * cached session value so anonymous bootstrap config cannot route the user to
 * the wrong backend before authenticated config confirms the flag.
 */
function resolveAuthGatedFlag(
  flagKey: string,
  remoteConfigValue: boolean | undefined,
  cachedValue: Ref<boolean | undefined>
): boolean {
  const override = getDevOverride<boolean>(flagKey)
  if (override !== undefined) return override

  if (!isCloud) return false
  if (!isAuthenticatedConfigLoaded.value) return cachedValue.value ?? false

  return remoteConfigValue ?? api.getServerFeature(flagKey, false)
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
      return resolveAuthGatedFlag(
        ServerFeatureFlag.TEAM_WORKSPACES_ENABLED,
        remoteConfig.value.team_workspaces_enabled,
        cachedTeamWorkspacesEnabled
      )
    },
    get partnerNodeGovernanceEnabled() {
      return resolveFlag(
        ServerFeatureFlag.PARTNER_NODE_GOVERNANCE_ENABLED,
        remoteConfig.value.partner_node_governance_enabled,
        false
      )
    },
    get userSecretsEnabled() {
      return resolveFlag(
        ServerFeatureFlag.USER_SECRETS_ENABLED,
        remoteConfig.value.user_secrets_enabled,
        false
      )
    },
    get nodeReplacementsEnabled() {
      return api.getServerFeature(ServerFeatureFlag.NODE_REPLACEMENTS, false)
    },
    get nodeLibraryEssentialsEnabled() {
      if (isNightly || import.meta.env.DEV) return true

      return (
        remoteConfig.value.node_library_essentials_enabled ??
        api.getServerFeature(
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
    },
    get showSignInButton(): boolean | undefined {
      return api.getServerFeature<boolean | undefined>(
        ServerFeatureFlag.SHOW_SIGNIN_BUTTON,
        undefined
      )
    },
    get unifiedCloudAuthEnabled() {
      return resolveFlag(
        ServerFeatureFlag.UNIFIED_CLOUD_AUTH,
        remoteConfig.value.unified_cloud_auth,
        false
      )
    },
    /**
     * Whether personal workspaces use the workspace-scoped billing flow. While
     * false (default), personal workspaces stay on the legacy per-user billing
     * flow; team workspaces are unaffected.
     */
    get billingControlEnabled() {
      return resolveAuthGatedFlag(
        ServerFeatureFlag.BILLING_CONTROL_ENABLED,
        remoteConfig.value.billing_control_enabled,
        cachedBillingControlEnabled
      )
    },
    get freeTierJobAllowanceEnabled() {
      const config = remoteConfig.value as typeof remoteConfig.value & {
        free_tier_job_allowance_enabled?: boolean
      }
      return resolveFlag(
        ServerFeatureFlag.FREE_TIER_JOB_ALLOWANCE_ENABLED,
        config.free_tier_job_allowance_enabled,
        false
      )
    },
    get signupTurnstileMode() {
      return resolveFlag(
        ServerFeatureFlag.SIGNUP_TURNSTILE,
        remoteConfig.value.signup_turnstile,
        'off'
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
