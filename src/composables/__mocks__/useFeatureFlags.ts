import { beforeEach, vi } from 'vitest'

import type * as realFeatureFlags from '../useFeatureFlags'

export const { ServerFeatureFlag } =
  await vi.importActual<typeof realFeatureFlags>('../useFeatureFlags')

export const startFeatureFlagTelemetry =
  vi.fn<typeof realFeatureFlags.startFeatureFlagTelemetry>()
export const useFeatureFlags = vi.fn<typeof realFeatureFlags.useFeatureFlags>()

beforeEach(() => {
  useFeatureFlags.mockReturnValue({
    flags: {
      supportsPreviewMetadata: false,
      maxUploadSize: 0,
      supportsManagerV4: false,
      modelUploadButtonEnabled: false,
      assetDeletionEnabled: false,
      assetRenameEnabled: false,
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
      showSignInButton: undefined,
      unifiedCloudAuthEnabled: false,
      billingControlEnabled: false,
      legacyBillingMigrationEnabled: false,
      embeddedCheckoutEnabled: false,
      v1PaymentRecovery: false,
      freeTierJobAllowanceEnabled: false,
      churnkeyAppId: '',
      signupTurnstileMode: 'off',
      supportsModelTypeTags: false,
      onboardingTourEnabled: false,
      assetsEnabled: false
    },
    featureFlag: vi.fn()
  })
})
