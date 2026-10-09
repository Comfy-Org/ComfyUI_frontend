import { onTestFinished, vi } from 'vitest'
import { computed, reactive, watchEffect } from 'vue'

import type { useFeatureFlags as realUseFeatureFlags } from '../useFeatureFlags'

export const startFeatureFlagTelemetry = vi.fn(() => watchEffect(() => {}))

type FeatureFlags = ReturnType<typeof realUseFeatureFlags>['flags']

const defaultFlags: FeatureFlags = {
  supportsPreviewMetadata: false,
  maxUploadSize: 0,
  supportsManagerV4: false,
  modelUploadButtonEnabled: false,
  assetDeletionEnabled: false,
  privateModelsEnabled: false,
  onboardingSurveyEnabled: false,
  linearToggleEnabled: false,
  partnerNodeGovernanceEnabled: false,
  partnerRunGateEnabled: false,
  userSecretsEnabled: false,
  nodeReplacementsEnabled: false,
  nodeLibraryEssentialsEnabled: false,
  workflowSharingEnabled: false,
  comfyHubUploadEnabled: false,
  comfyHubProfileGateEnabled: false,
  hostedBillingDestination: 'stripe',
  hostedBillingWebEnabled: false,
  showSignInButton: undefined,
  unifiedCloudAuthEnabled: false,
  unifiedWebSessionEnabled: false,
  ssoEnabled: false,
  billingControlEnabled: false,
  memberCreditLimitsEnabled: false,
  legacyBillingMigrationEnabled: false,
  embeddedCheckoutEnabled: false,
  billingSdkTopupEnabled: false,
  billingSdkTopupRailEnabled: false,
  billingSdkSubscriptionEnabled: false,
  billingSdkSubscriptionRailEnabled: false,
  v1PaymentRecovery: false,
  freeTierJobAllowanceEnabled: false,
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
