import type { GetFeaturesResponse } from '@comfyorg/ingest-types'
import { computed, reactive, readonly, watchEffect } from 'vue'

import { normalizeHostedBillingDestination } from '@/platform/billing/billingWeb'
import { isCloud, isNightly } from '@/platform/distribution/types'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'
import { useTelemetry } from '@comfyorg/telemetry'
import { api } from '@/scripts/api'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

function reportFeatureFlagEvaluation<T>(flagKey: string, value: T): T {
  useTelemetry()?.trackFeatureFlagEvaluation(flagKey, value)
  return value
}

/**
 * Resolves a feature flag value with session override > dev override >
 * remoteConfig > serverFeature priority.
 */
function resolveFlag<T>(
  flagKey: string,
  remoteConfigValue: T | undefined,
  defaultValue: T
): T {
  const sessionOverride = getSessionOverride<T>(flagKey)
  if (sessionOverride !== undefined) return sessionOverride

  const override = getDevOverride<T>(flagKey)
  if (override !== undefined) return override
  return remoteConfigValue ?? api.getServerFeature(flagKey, defaultValue)
}

/**
 * A flag that enables a payment flow: same channels as `resolveFlag`, but only
 * a literal `true` counts. A malformed wire value (`'true'`, `1`) or a failed
 * lookup resolves to false rather than switching a charge onto a new transport.
 *
 * Needs no auth gate: the server returns a concrete `false` for these keys to
 * an unauthenticated caller, so the anonymous window resolves to the legacy
 * rail and cannot enable a flow before authenticated config confirms it.
 */
function resolveStrictBooleanFlag(
  flagKey: string,
  remoteConfigValue: boolean | undefined
): boolean {
  try {
    return resolveFlag<unknown>(flagKey, remoteConfigValue, false) === true
  } catch {
    return false
  }
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
  cachedValue: boolean | undefined
): boolean {
  const sessionOverride = getSessionOverride<boolean>(flagKey)
  if (sessionOverride !== undefined) return sessionOverride

  const override = getDevOverride<boolean>(flagKey)
  if (override !== undefined) return override

  if (!isCloud) return false
  if (!useRemoteConfigStore().isAuthenticatedConfigLoaded)
    return cachedValue ?? false

  return remoteConfigValue ?? api.getServerFeature(flagKey, false)
}

/**
 * Resolves a per-user allowlist flag. Before the first authenticated answer it
 * is off; after one, a failed refresh falls back to that answer so a blip
 * cannot pull a granted surface out from under the user mid-session. Unlike
 * `resolveAuthGatedFlag` the fallback is never read from storage — a persisted
 * grant is what let one browser show the surface while another hid it for the
 * same account (PM-1707).
 */
function resolveWhitelistFlag(
  flagKey: string,
  remoteConfigValue: boolean | undefined
): boolean {
  const sessionOverride = getSessionOverride<boolean>(flagKey)
  if (sessionOverride !== undefined) return sessionOverride

  const override = getDevOverride<boolean>(flagKey)
  if (override !== undefined) return override

  if (!isCloud) return false
  const store = useRemoteConfigStore()
  if (!store.isAuthenticatedConfigLoaded)
    return (
      store.agentGrant === true &&
      (store.agentGrantValidUntil ?? 0) > Date.now()
    )

  return remoteConfigValue === true
}

/**
 * Composable for reactive access to server-side feature flags
 */
export function useFeatureFlags() {
  const remoteConfig = () => useRemoteConfigStore().config
  const hostedBillingDestination = () =>
    normalizeHostedBillingDestination(
      resolveFlag(
        ServerFeatureFlag.HOSTED_BILLING_DESTINATION,
        remoteConfig().hosted_billing_destination,
        'stripe'
      )
    )

  const flags = reactive({
    get supportsPreviewMetadata() {
      return api.getServerFeature(ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA)
    },
    get maxUploadSize() {
      return api.getServerFeature<GetFeaturesResponse['max_upload_size']>(
        ServerFeatureFlag.MAX_UPLOAD_SIZE
      )
    },
    get supportsManagerV4() {
      return api.getServerFeature(ServerFeatureFlag.MANAGER_SUPPORTS_V4)
    },
    /** ComfyUI's `agent` server feature; callers validate `state`. */
    get agent() {
      return api.getServerFeature<{ state?: unknown } | null | undefined>(
        ServerFeatureFlag.AGENT
      )
    },
    get modelUploadButtonEnabled() {
      return resolveFlag(
        ServerFeatureFlag.MODEL_UPLOAD_BUTTON_ENABLED,
        remoteConfig().model_upload_button_enabled,
        false
      )
    },
    get assetDeletionEnabled() {
      return resolveFlag(
        ServerFeatureFlag.ASSET_DELETION_ENABLED,
        undefined,
        false
      )
    },
    get privateModelsEnabled() {
      return resolveFlag(
        ServerFeatureFlag.PRIVATE_MODELS_ENABLED,
        remoteConfig().private_models_enabled,
        false
      )
    },
    get onboardingSurveyEnabled() {
      return resolveFlag(
        ServerFeatureFlag.ONBOARDING_SURVEY_ENABLED,
        remoteConfig().onboarding_survey_enabled,
        false
      )
    },
    get signedOutRerouteEnabled() {
      return resolveFlag(
        ServerFeatureFlag.SIGNED_OUT_REROUTE_ENABLED,
        remoteConfig().signed_out_reroute_enabled,
        false
      )
    },
    get partnerNodeGovernanceEnabled() {
      return resolveFlag(
        ServerFeatureFlag.PARTNER_NODE_GOVERNANCE_ENABLED,
        remoteConfig().partner_node_governance_enabled,
        false
      )
    },
    get partnerRunGateEnabled() {
      return resolveFlag(
        ServerFeatureFlag.PARTNER_RUN_GATE_ENABLED,
        remoteConfig().partner_run_gate_enabled,
        true
      )
    },
    get deploymentStartEnabled() {
      return resolveStrictBooleanFlag(
        ServerFeatureFlag.DEPLOYMENT_START_ENABLED,
        remoteConfig().deployment_start_enabled
      )
    },
    get partnerNodeTokenEnabled() {
      return resolveStrictBooleanFlag(
        ServerFeatureFlag.PARTNER_NODE_TOKEN,
        remoteConfig().partner_node_token
      )
    },
    get userSecretsEnabled() {
      return resolveFlag(
        ServerFeatureFlag.USER_SECRETS_ENABLED,
        remoteConfig().user_secrets_enabled,
        false
      )
    },
    get nodeReplacementsEnabled() {
      return api.getServerFeature(ServerFeatureFlag.NODE_REPLACEMENTS, false)
    },
    get openOnCloudEnabled() {
      return resolveFlag(
        ServerFeatureFlag.OPEN_ON_CLOUD_ENABLED,
        remoteConfig().open_on_cloud_enabled,
        import.meta.env.DEV
      )
    },
    get deployToCloud() {
      return api.getServerFeature(ServerFeatureFlag.DEPLOY_TO_CLOUD, false)
    },
    get nodeLibraryEssentialsEnabled() {
      return resolveFlag(
        ServerFeatureFlag.NODE_LIBRARY_ESSENTIALS_ENABLED,
        remoteConfig().node_library_essentials_enabled,
        isNightly || import.meta.env.DEV
      )
    },
    get comfyHubUploadEnabled() {
      return resolveFlag(
        ServerFeatureFlag.COMFYHUB_UPLOAD_ENABLED,
        remoteConfig().comfyhub_upload_enabled,
        false
      )
    },
    get comfyHubProfileGateEnabled() {
      return resolveFlag(
        ServerFeatureFlag.COMFYHUB_PROFILE_GATE_ENABLED,
        remoteConfig().comfyhub_profile_gate_enabled,
        false
      )
    },
    get deploymentCompatibilityMarksEnabled() {
      return resolveFlag(
        ServerFeatureFlag.DEPLOYMENT_COMPATIBILITY_MARKS_ENABLED,
        remoteConfig().deployment_compatibility_marks_enabled,
        false
      )
    },
    get runtimeLibraryModelsEnabled() {
      return resolveFlag(
        ServerFeatureFlag.RUNTIME_LIBRARY_MODELS_ENABLED,
        remoteConfig().runtime_library_models_enabled,
        false
      )
    },
    /** The model folders an uploaded model file may go into; empty when uploads are off. */
    get modelUploadFolders(): readonly string[] {
      return resolveFlag<readonly string[]>(
        ServerFeatureFlag.MODEL_UPLOAD_FOLDERS,
        remoteConfig().model_upload_folders,
        []
      )
    },
    get lateCustomNodesEnabled() {
      return resolveFlag(
        ServerFeatureFlag.LATE_CUSTOM_NODES_ENABLED,
        remoteConfig().late_custom_nodes_enabled,
        false
      )
    },
    get hostedBillingDestination() {
      return hostedBillingDestination()
    },
    get hostedBillingWebEnabled() {
      return hostedBillingDestination() === 'billing_web'
    },
    get showSignInButton(): boolean | undefined {
      return api.getServerFeature<boolean | undefined>(
        ServerFeatureFlag.SHOW_SIGNIN_BUTTON,
        undefined
      )
    },
    get unifiedCloudAuthEnabled() {
      if (!isCloud) return false

      return resolveFlag(
        ServerFeatureFlag.UNIFIED_CLOUD_AUTH,
        remoteConfig().unified_cloud_auth,
        false
      )
    },
    get unifiedWebSessionEnabled() {
      if (!isCloud) return false

      const key = ServerFeatureFlag.UNIFIED_WEB_SESSION
      const value =
        getSessionOverride<unknown>(key) ??
        getDevOverride<unknown>(key) ??
        remoteConfig().unified_web_session
      return value === true
    },
    get ssoEnabled() {
      if (!isCloud) return false

      return resolveStrictBooleanFlag(
        ServerFeatureFlag.SSO_ENABLED,
        remoteConfig().sso_enabled
      )
    },
    /** Browser sign-in for a local ComfyUI that Desktop does not host. */
    get localWebSsoEnabled() {
      if (isCloud) return false

      return resolveStrictBooleanFlag(
        ServerFeatureFlag.LOCAL_WEB_SSO,
        remoteConfig().local_web_sso
      )
    },
    get billingControlEnabled() {
      return resolveAuthGatedFlag(
        ServerFeatureFlag.BILLING_CONTROL_ENABLED,
        remoteConfig().billing_control_enabled,
        useRemoteConfigStore().cachedBillingControlEnabled
      )
    },
    get memberCreditLimitsEnabled() {
      return resolveStrictBooleanFlag(
        ServerFeatureFlag.MEMBER_CREDIT_LIMITS_ENABLED,
        remoteConfig().member_credit_limits_enabled
      )
    },
    get billingNewUxEnabled() {
      return resolveStrictBooleanFlag(
        ServerFeatureFlag.BILLING_NEW_UX_ENABLED,
        remoteConfig().billing_new_ux_enabled
      )
    },
    get billingAutoTopUpAtCheckoutEnabled() {
      return resolveStrictBooleanFlag(
        ServerFeatureFlag.BILLING_AUTO_TOP_UP_AT_CHECKOUT_ENABLED,
        remoteConfig().billing_auto_top_up_at_checkout_enabled
      )
    },
    get billingSdkTopupEnabled() {
      return resolveStrictBooleanFlag(
        ServerFeatureFlag.BILLING_SDK_TOPUP_ENABLED,
        remoteConfig().billing_sdk_topup_enabled
      )
    },
    /** The SDK rail runs on the unified session, so it needs both flags. */
    get billingSdkTopupRailEnabled() {
      return this.billingSdkTopupEnabled && this.unifiedCloudAuthEnabled
    },
    get billingSdkSubscriptionEnabled() {
      return resolveStrictBooleanFlag(
        ServerFeatureFlag.BILLING_SDK_SUBSCRIPTION_ENABLED,
        remoteConfig().billing_sdk_subscription_enabled
      )
    },
    get billingSdkSubscriptionRailEnabled() {
      return this.billingSdkSubscriptionEnabled && this.unifiedCloudAuthEnabled
    },
    get unifiedBillingSettingsEnabled() {
      return resolveStrictBooleanFlag(
        ServerFeatureFlag.UNIFIED_BILLING_SETTINGS,
        remoteConfig().unified_billing_settings
      )
    },
    get pricingTableFallback() {
      return resolveStrictBooleanFlag(
        ServerFeatureFlag.PRICING_TABLE_FALLBACK,
        remoteConfig().pricing_table_fallback
      )
    },
    get oauthConsentSwitchAccountEnabled() {
      return resolveFlag(
        ServerFeatureFlag.OAUTH_CONSENT_SWITCH_ACCOUNT_ENABLED,
        remoteConfig().oauth_consent_switch_account_enabled,
        false
      )
    },
    get v1PaymentRecovery() {
      return resolveAuthGatedFlag(
        ServerFeatureFlag.V1_PAYMENT_RECOVERY,
        remoteConfig().v1_payment_recovery,
        useRemoteConfigStore().cachedV1PaymentRecovery
      )
    },
    get signupTurnstileMode() {
      return resolveFlag(
        ServerFeatureFlag.SIGNUP_TURNSTILE,
        remoteConfig().signup_turnstile,
        'off'
      )
    },
    get supportsModelTypeTags() {
      return resolveFlag(
        ServerFeatureFlag.SUPPORTS_MODEL_TYPE_TAGS,
        remoteConfig().supports_model_type_tags,
        false
      )
    },
    get assetsEnabled() {
      return isCloud || resolveFlag('assets', undefined, false)
    },
    get agentInAppExperienceEnabled() {
      return resolveWhitelistFlag(
        ServerFeatureFlag.AGENT_IN_APP_EXPERIENCE,
        remoteConfig()['agent-in-app-experience']
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

export function startFeatureFlagTelemetry() {
  const { flags } = useFeatureFlags()

  return watchEffect(() => {
    const evaluations = {
      [ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA]:
        flags.supportsPreviewMetadata,
      [ServerFeatureFlag.MAX_UPLOAD_SIZE]: flags.maxUploadSize,
      [ServerFeatureFlag.MANAGER_SUPPORTS_V4]: flags.supportsManagerV4,
      [ServerFeatureFlag.MODEL_UPLOAD_BUTTON_ENABLED]:
        flags.modelUploadButtonEnabled,
      [ServerFeatureFlag.ASSET_DELETION_ENABLED]: flags.assetDeletionEnabled,
      [ServerFeatureFlag.PRIVATE_MODELS_ENABLED]: flags.privateModelsEnabled,
      [ServerFeatureFlag.ONBOARDING_SURVEY_ENABLED]:
        flags.onboardingSurveyEnabled,
      [ServerFeatureFlag.SIGNED_OUT_REROUTE_ENABLED]:
        flags.signedOutRerouteEnabled,
      [ServerFeatureFlag.PARTNER_NODE_GOVERNANCE_ENABLED]:
        flags.partnerNodeGovernanceEnabled,
      [ServerFeatureFlag.USER_SECRETS_ENABLED]: flags.userSecretsEnabled,
      [ServerFeatureFlag.NODE_REPLACEMENTS]: flags.nodeReplacementsEnabled,
      [ServerFeatureFlag.OPEN_ON_CLOUD_ENABLED]: flags.openOnCloudEnabled,
      [ServerFeatureFlag.NODE_LIBRARY_ESSENTIALS_ENABLED]:
        flags.nodeLibraryEssentialsEnabled,
      [ServerFeatureFlag.COMFYHUB_UPLOAD_ENABLED]: flags.comfyHubUploadEnabled,
      [ServerFeatureFlag.COMFYHUB_PROFILE_GATE_ENABLED]:
        flags.comfyHubProfileGateEnabled,
      [ServerFeatureFlag.HOSTED_BILLING_DESTINATION]:
        flags.hostedBillingDestination,
      [ServerFeatureFlag.SHOW_SIGNIN_BUTTON]: flags.showSignInButton,
      [ServerFeatureFlag.UNIFIED_CLOUD_AUTH]: flags.unifiedCloudAuthEnabled,
      [ServerFeatureFlag.UNIFIED_WEB_SESSION]: flags.unifiedWebSessionEnabled,
      [ServerFeatureFlag.SSO_ENABLED]: flags.ssoEnabled,
      [ServerFeatureFlag.BILLING_CONTROL_ENABLED]: flags.billingControlEnabled,
      [ServerFeatureFlag.MEMBER_CREDIT_LIMITS_ENABLED]:
        flags.memberCreditLimitsEnabled,
      [ServerFeatureFlag.BILLING_NEW_UX_ENABLED]: flags.billingNewUxEnabled,
      [ServerFeatureFlag.BILLING_AUTO_TOP_UP_AT_CHECKOUT_ENABLED]:
        flags.billingAutoTopUpAtCheckoutEnabled,
      [ServerFeatureFlag.BILLING_SDK_TOPUP_ENABLED]:
        flags.billingSdkTopupEnabled,
      [ServerFeatureFlag.BILLING_SDK_SUBSCRIPTION_ENABLED]:
        flags.billingSdkSubscriptionEnabled,
      [ServerFeatureFlag.UNIFIED_BILLING_SETTINGS]:
        flags.unifiedBillingSettingsEnabled,
      [ServerFeatureFlag.PRICING_TABLE_FALLBACK]: flags.pricingTableFallback,
      [ServerFeatureFlag.OAUTH_CONSENT_SWITCH_ACCOUNT_ENABLED]:
        flags.oauthConsentSwitchAccountEnabled,
      [ServerFeatureFlag.V1_PAYMENT_RECOVERY]: flags.v1PaymentRecovery,
      [ServerFeatureFlag.SIGNUP_TURNSTILE]: flags.signupTurnstileMode,
      [ServerFeatureFlag.SUPPORTS_MODEL_TYPE_TAGS]: flags.supportsModelTypeTags,
      [ServerFeatureFlag.AGENT_IN_APP_EXPERIENCE]:
        flags.agentInAppExperienceEnabled,
      assets: flags.assetsEnabled
    }

    for (const [key, value] of Object.entries(evaluations))
      reportFeatureFlagEvaluation(key, value)
  })
}
