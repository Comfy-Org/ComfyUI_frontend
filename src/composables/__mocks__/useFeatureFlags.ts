import { onTestFinished, vi } from 'vitest'
import { computed, reactive, watchEffect } from 'vue'

import type { useFeatureFlags as realUseFeatureFlags } from '@/composables/useFeatureFlags'

export const startFeatureFlagTelemetry = vi.fn(() => watchEffect(() => {}))

type FeatureFlags = ReturnType<typeof realUseFeatureFlags>['flags']

const defaultFlags: FeatureFlags = {
  supportsPreviewMetadata: false,
  maxUploadSize: 0,
  supportsManagerV4: false,
  agent: undefined,
  modelUploadButtonEnabled: false,
  assetDeletionEnabled: false,
  privateModelsEnabled: false,
  onboardingSurveyEnabled: false,
  linearToggleEnabled: false,
  partnerNodeGovernanceEnabled: false,
  partnerRunGateEnabled: false,
  partnerNodeTokenEnabled: false,
  userSecretsEnabled: false,
  nodeReplacementsEnabled: false,
  deployToCloud: false,
  nodeLibraryEssentialsEnabled: false,
  comfyHubUploadEnabled: false,
  comfyHubProfileGateEnabled: false,
  deploymentCompatibilityMarksEnabled: false,
  hostedBillingDestination: 'stripe',
  hostedBillingWebEnabled: false,
  showSignInButton: undefined,
  unifiedCloudAuthEnabled: false,
  unifiedWebSessionEnabled: false,
  ssoEnabled: false,
  localWebSsoEnabled: false,
  billingControlEnabled: false,
  memberCreditLimitsEnabled: false,
  billingSdkTopupEnabled: false,
  billingSdkTopupRailEnabled: false,
  billingSdkSubscriptionEnabled: false,
  unifiedBillingSettingsEnabled: false,
  autoTopUpEnabled: false,
  billingSdkSubscriptionRailEnabled: false,
  v1PaymentRecovery: false,
  signupTurnstileMode: 'off',
  supportsModelTypeTags: false,
  onboardingTourEnabled: false,
  assetsEnabled: false,
  agentInAppExperienceEnabled: false
}

const featureFlags: ReturnType<typeof realUseFeatureFlags> = {
  flags: reactive({ ...defaultFlags }),
  featureFlag: vi.fn((_, defaultValue) => computed(() => defaultValue))
}

export const useFeatureFlags = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(featureFlags.flags, defaultFlags)
  })
  return featureFlags
})
