import { computed, reactive, readonly } from 'vue'
import type { Ref } from 'vue'

import { isCloud, isNightly } from '@/platform/distribution/types'
import {
  cachedBillingControlEnabled,
  cachedConsolidatedBillingEnabled,
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
  CONSOLIDATED_BILLING_ENABLED = 'consolidated_billing_enabled',
  BILLING_CONTROL_ENABLED = 'billing_control_enabled',
  FREE_TIER_JOB_ALLOWANCE_ENABLED = 'free_tier_job_allowance_enabled',
  SIGNUP_TURNSTILE = 'signup_turnstile',
  SUPPORTS_MODEL_TYPE_TAGS = 'supports_model_type_tags'
}

interface FeatureFlagDefinition<T> {
  key: string
  resolve: (key: string) => T
}

type FeatureFlagDefinitions = Record<string, FeatureFlagDefinition<unknown>>

type ResolvedFeatureFlags<T extends FeatureFlagDefinitions> = {
  readonly [K in keyof T]: T[K] extends FeatureFlagDefinition<infer V>
    ? V
    : never
}

function defineFeatureFlag<T>(
  key: string,
  resolve: (key: string) => T
): FeatureFlagDefinition<T> {
  return { key, resolve }
}

function createFeatureFlags<const T extends FeatureFlagDefinitions>(
  definitions: T
): ResolvedFeatureFlags<T> {
  const flags: Record<string, unknown> = {}

  for (const [property, { key, resolve }] of Object.entries(definitions)) {
    Object.defineProperty(flags, property, {
      enumerable: true,
      get: () => resolve(key)
    })
  }

  return flags as ResolvedFeatureFlags<T>
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
  const flags = reactive(
    createFeatureFlags({
      supportsPreviewMetadata: defineFeatureFlag(
        ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA,
        (key) => api.getServerFeature(key)
      ),
      maxUploadSize: defineFeatureFlag(
        ServerFeatureFlag.MAX_UPLOAD_SIZE,
        (key) => api.getServerFeature(key)
      ),
      supportsManagerV4: defineFeatureFlag(
        ServerFeatureFlag.MANAGER_SUPPORTS_V4,
        (key) => api.getServerFeature(key)
      ),
      modelUploadButtonEnabled: defineFeatureFlag(
        ServerFeatureFlag.MODEL_UPLOAD_BUTTON_ENABLED,
        (key) =>
          resolveFlag(
            key,
            remoteConfig.value.model_upload_button_enabled,
            false
          )
      ),
      assetRenameEnabled: defineFeatureFlag(
        ServerFeatureFlag.ASSET_RENAME_ENABLED,
        (key) =>
          resolveFlag(key, remoteConfig.value.asset_rename_enabled, false)
      ),
      privateModelsEnabled: defineFeatureFlag(
        ServerFeatureFlag.PRIVATE_MODELS_ENABLED,
        (key) =>
          resolveFlag(key, remoteConfig.value.private_models_enabled, false)
      ),
      onboardingSurveyEnabled: defineFeatureFlag(
        ServerFeatureFlag.ONBOARDING_SURVEY_ENABLED,
        (key) =>
          resolveFlag(key, remoteConfig.value.onboarding_survey_enabled, false)
      ),
      linearToggleEnabled: defineFeatureFlag(
        ServerFeatureFlag.LINEAR_TOGGLE_ENABLED,
        (key) =>
          isNightly
            ? true
            : resolveFlag(key, remoteConfig.value.linear_toggle_enabled, false)
      ),
      /**
       * Whether team workspaces feature is enabled.
       * IMPORTANT: Returns false until authenticated remote config is loaded.
       * This ensures we never use workspace tokens when the feature is disabled,
       * and prevents race conditions during initialization.
       */
      teamWorkspacesEnabled: defineFeatureFlag(
        ServerFeatureFlag.TEAM_WORKSPACES_ENABLED,
        (key) =>
          resolveAuthGatedFlag(
            key,
            remoteConfig.value.team_workspaces_enabled,
            cachedTeamWorkspacesEnabled
          )
      ),
      partnerNodeGovernanceEnabled: defineFeatureFlag(
        ServerFeatureFlag.PARTNER_NODE_GOVERNANCE_ENABLED,
        (key) =>
          resolveFlag(
            key,
            remoteConfig.value.partner_node_governance_enabled,
            false
          )
      ),
      userSecretsEnabled: defineFeatureFlag(
        ServerFeatureFlag.USER_SECRETS_ENABLED,
        (key) =>
          resolveFlag(key, remoteConfig.value.user_secrets_enabled, false)
      ),
      nodeReplacementsEnabled: defineFeatureFlag(
        ServerFeatureFlag.NODE_REPLACEMENTS,
        (key) => api.getServerFeature(key, false)
      ),
      nodeLibraryEssentialsEnabled: defineFeatureFlag(
        ServerFeatureFlag.NODE_LIBRARY_ESSENTIALS_ENABLED,
        (key) =>
          isNightly || import.meta.env.DEV
            ? true
            : (remoteConfig.value.node_library_essentials_enabled ??
              api.getServerFeature(key, false))
      ),
      workflowSharingEnabled: defineFeatureFlag(
        ServerFeatureFlag.WORKFLOW_SHARING_ENABLED,
        (key) =>
          resolveFlag(key, remoteConfig.value.workflow_sharing_enabled, false)
      ),
      comfyHubUploadEnabled: defineFeatureFlag(
        ServerFeatureFlag.COMFYHUB_UPLOAD_ENABLED,
        (key) =>
          resolveFlag(key, remoteConfig.value.comfyhub_upload_enabled, false)
      ),
      comfyHubProfileGateEnabled: defineFeatureFlag(
        ServerFeatureFlag.COMFYHUB_PROFILE_GATE_ENABLED,
        (key) =>
          resolveFlag(
            key,
            remoteConfig.value.comfyhub_profile_gate_enabled,
            false
          )
      ),
      showSignInButton: defineFeatureFlag(
        ServerFeatureFlag.SHOW_SIGNIN_BUTTON,
        (key) => api.getServerFeature<boolean | undefined>(key, undefined)
      ),
      unifiedCloudAuthEnabled: defineFeatureFlag(
        ServerFeatureFlag.UNIFIED_CLOUD_AUTH,
        (key) => resolveFlag(key, remoteConfig.value.unified_cloud_auth, false)
      ),
      /**
       * Whether personal workspaces use the consolidated (workspace-scoped)
       * billing flow. While false (default), personal workspaces stay on the
       * legacy per-user billing flow; team workspaces are unaffected.
       */
      consolidatedBillingEnabled: defineFeatureFlag(
        ServerFeatureFlag.CONSOLIDATED_BILLING_ENABLED,
        (key) =>
          resolveAuthGatedFlag(
            key,
            remoteConfig.value.consolidated_billing_enabled,
            cachedConsolidatedBillingEnabled
          )
      ),
      billingControlEnabled: defineFeatureFlag(
        ServerFeatureFlag.BILLING_CONTROL_ENABLED,
        (key) =>
          resolveAuthGatedFlag(
            key,
            remoteConfig.value.billing_control_enabled,
            cachedBillingControlEnabled
          )
      ),
      freeTierJobAllowanceEnabled: defineFeatureFlag(
        ServerFeatureFlag.FREE_TIER_JOB_ALLOWANCE_ENABLED,
        (key) => {
          const config = remoteConfig.value as typeof remoteConfig.value & {
            free_tier_job_allowance_enabled?: boolean
          }
          return resolveFlag(key, config.free_tier_job_allowance_enabled, false)
        }
      ),
      signupTurnstileMode: defineFeatureFlag(
        ServerFeatureFlag.SIGNUP_TURNSTILE,
        (key) => resolveFlag(key, remoteConfig.value.signup_turnstile, 'off')
      ),
      supportsModelTypeTags: defineFeatureFlag(
        ServerFeatureFlag.SUPPORTS_MODEL_TYPE_TAGS,
        (key) => api.getServerFeature(key, false)
      )
    })
  )

  const featureFlag = <T = unknown>(featurePath: string, defaultValue?: T) =>
    computed(() => api.getServerFeature(featurePath, defaultValue))

  return {
    flags: readonly(flags),
    featureFlag
  }
}
