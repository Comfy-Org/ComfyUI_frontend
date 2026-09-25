import { useFeatureFlags } from '@/composables/useFeatureFlags'

function resolveFeatureFlagPolicyFixture(enabled: boolean) {
  return enabled ? 'candidate' : 'current'
}

export function featureFlagPolicyFixtureBehavior() {
  return resolveFeatureFlagPolicyFixture(
    useFeatureFlags().flags.featureFlagPolicyFixtureEnabled
  )
}
