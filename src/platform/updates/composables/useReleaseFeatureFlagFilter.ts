import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import { api } from '@/scripts/api'

import type { ReleaseNote } from '../common/releaseService'

interface UseReleaseFeatureFlagFilterOptions {
  releases: Ref<ReleaseNote[]> | ComputedRef<ReleaseNote[]>
}

/**
 * Evaluates a single feature flag by name.
 * Checks remote config first, then falls back to server feature flags.
 */
function evaluateFeatureFlag(flagName: string): boolean {
  // Check remote config first (keyed by snake_case)
  const remoteValue = remoteConfig.value[flagName as keyof RemoteConfig]
  if (remoteValue !== undefined) {
    return Boolean(remoteValue)
  }

  // Fall back to server feature flags
  return Boolean(api.getServerFeature(flagName, false))
}

/**
 * Checks if a release note should be shown based on its feature flag requirements.
 * - If no feature flag requirements, the release is shown (backward compatible)
 * - required_feature_flags: ALL must be enabled (AND logic)
 * - excluded_feature_flags: ALL must be disabled (AND logic)
 */
function shouldShowRelease(release: ReleaseNote): boolean {
  const { required_feature_flags, excluded_feature_flags } = release

  // If no feature flag requirements, show the release (backward compatible)
  if (!required_feature_flags?.length && !excluded_feature_flags?.length) {
    return true
  }

  // Check required flags (all must be enabled - AND logic)
  if (required_feature_flags?.length) {
    const allRequiredEnabled = required_feature_flags.every(evaluateFeatureFlag)
    if (!allRequiredEnabled) {
      return false
    }
  }

  // Check excluded flags (all must be disabled - AND logic)
  if (excluded_feature_flags?.length) {
    const anyExcludedEnabled = excluded_feature_flags.some(evaluateFeatureFlag)
    if (anyExcludedEnabled) {
      return false
    }
  }

  return true
}

/**
 * Composable for filtering release notes based on feature flags.
 * Used to show/hide "What's New" popup content for specific test cohorts.
 */
export function useReleaseFeatureFlagFilter({
  releases
}: UseReleaseFeatureFlagFilterOptions) {
  const filteredReleases = computed(() => {
    return releases.value.filter(shouldShowRelease)
  })

  return {
    filteredReleases,
    evaluateFeatureFlag,
    shouldShowRelease
  }
}
