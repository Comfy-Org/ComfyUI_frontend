import { useFeatureFlags } from '@/composables/useFeatureFlags'

function resolveFeatureFlagPolicyEscalatedFixture(enabled: boolean) {
  return enabled ? 'candidate' : 'current'
}

export function featureFlagPolicyEscalatedFixtureBehavior() {
  return resolveFeatureFlagPolicyEscalatedFixture(
    useFeatureFlags().flags.featureFlagPolicyFixtureEnabled
  )
}
