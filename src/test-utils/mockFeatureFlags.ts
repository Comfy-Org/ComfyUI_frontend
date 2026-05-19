import { vi } from 'vitest'

import type {
  FeatureFlags,
  useFeatureFlags
} from '@/composables/useFeatureFlags'

/**
 * Mock implementation of `useFeatureFlags()` for unit/component tests.
 *
 * All flags default to their production opt-in default (mostly `false`);
 * pass overrides to enable specific ones for the test.
 *
 * @example
 *   vi.mock('@/composables/useFeatureFlags', () => ({
 *     useFeatureFlags: () => mockFeatureFlags({ assetRenameEnabled: true })
 *   }))
 */
export function mockFeatureFlags(
  overrides: Partial<FeatureFlags> = {}
): ReturnType<typeof useFeatureFlags> {
  const flags: FeatureFlags = {
    supportsPreviewMetadata: false,
    maxUploadSize: 0,
    supportsManagerV4: false,
    modelUploadButtonEnabled: false,
    assetRenameEnabled: false,
    privateModelsEnabled: false,
    onboardingSurveyEnabled: false,
    linearToggleEnabled: false,
    teamWorkspacesEnabled: false,
    userSecretsEnabled: false,
    nodeReplacementsEnabled: false,
    nodeLibraryEssentialsEnabled: false,
    workflowSharingEnabled: false,
    comfyHubUploadEnabled: false,
    comfyHubProfileGateEnabled: false,
    showSignInButton: undefined,
    ...overrides
  }

  return {
    flags,
    featureFlag: vi.fn() as unknown as ReturnType<
      typeof useFeatureFlags
    >['featureFlag']
  }
}
