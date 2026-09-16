import { vi } from 'vitest'
import { computed } from 'vue'

import type * as realFeatureFlags from '../useFeatureFlags'

export const { ServerFeatureFlag } =
  await vi.importActual<typeof realFeatureFlags>('../useFeatureFlags')

function createWatchHandle() {
  const stop = vi.fn()
  return Object.assign(stop, { pause: vi.fn(), resume: vi.fn(), stop })
}

export const startFeatureFlagTelemetry =
  vi.fn<typeof realFeatureFlags.startFeatureFlagTelemetry>(createWatchHandle)

function createFeatureFlagsMock(): ReturnType<
  typeof realFeatureFlags.useFeatureFlags
> {
  return {
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
      hostedBillingDestination: 'stripe',
      hostedBillingWebEnabled: false,
      showSignInButton: undefined,
      unifiedCloudAuthEnabled: false,
      billingControlEnabled: false,
      legacyBillingMigrationEnabled: false,
      embeddedCheckoutEnabled: false,
      billingSdkTopupEnabled: false,
      billingSdkTopupRailEnabled: false,
      v1PaymentRecovery: false,
      freeTierJobAllowanceEnabled: false,
      churnkeyAppId: '',
      signupTurnstileMode: 'off',
      supportsModelTypeTags: false,
      onboardingTourEnabled: false,
      assetsEnabled: false
    },
    featureFlag: vi.fn((_, defaultValue) => computed(() => defaultValue))
  }
}

export const useFeatureFlags = vi.fn<typeof realFeatureFlags.useFeatureFlags>(
  createFeatureFlagsMock
)
