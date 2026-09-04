import { describe, expect, it, vi } from 'vitest'

import { featureFlagPolicyEscalatedFixtureBehavior } from './featureFlagPolicyEscalatedFixture'

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: { featureFlagPolicyFixtureEnabled: false }
  })
}))

describe('featureFlagPolicyEscalatedFixtureBehavior', () => {
  it('preserves current behavior while the flag is off', () => {
    expect(featureFlagPolicyEscalatedFixtureBehavior()).toBe('current')
  })
})
