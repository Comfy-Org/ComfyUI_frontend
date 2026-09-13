import { describe, expect, it, vi } from 'vitest'

import { featureFlagPolicyFixtureBehavior } from './featureFlagPolicyFixture'

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: { featureFlagPolicyFixtureEnabled: false }
  })
}))

describe('featureFlagPolicyFixtureBehavior', () => {
  it('preserves current behavior while the flag is off', () => {
    expect(featureFlagPolicyFixtureBehavior()).toBe('current')
  })
})
