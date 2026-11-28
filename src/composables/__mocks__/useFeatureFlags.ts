import { onTestFinished, vi } from 'vitest'
import { computed, reactive, watchEffect } from 'vue'

import type { useFeatureFlags as realUseFeatureFlags } from '@/composables/useFeatureFlags'

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
  signedOutRerouteEnabled: false,
  partnerNodeGovernanceEnabled: false,
  partnerRunGateEnabled: false,
  partnerNodeTokenEnabled: false,
  deploymentStartEnabled: false,
  userSecretsEnabled: false,
  nodeReplacementsEnabled: false,
  deployToCloud: false,
  openOnCloudEnabled: false,
  openOnCloudModelUploadEnabled: false,
  openOnCloudUseLocalAgentEnabled: false,
  nodeLibraryEssentialsEnabled: false,
  comfyHubUploadEnabled: false,
  comfyHubProfileGateEnabled: false,
  deploymentCompatibilityMarksEnabled: false,
  lateCustomNodesEnabled: false,
  customDeploymentsEditorEnabled: false,
  runtimeLibraryModelsEnabled: false,
  modelUploadFolders: [],
  hostedBillingDestination: 'stripe',
  hostedBillingWebEnabled: false,
  showSignInButton: undefined,
  ssoEnabled: false,
  webSessionLapseRecoveryEnabled: false,
  localWebSsoEnabled: false,
  localMcpConnectEnabled: false,
  billingControlEnabled: false,
  memberCreditLimitsEnabled: false,
  billingNewUxEnabled: false,
  billingAutoTopUpAtCheckoutEnabled: false,
  billingSdkRailEnabled: false,
  unifiedBillingSettingsEnabled: false,
  oauthConsentSwitchAccountEnabled: false,
  v1PaymentRecovery: false,
  signupTurnstileMode: 'off',
  supportsModelTypeTags: false,
  projectsEnabled: false,
  assetsEnabled: false,
  agentCrdtDebugEnabled: false,
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
