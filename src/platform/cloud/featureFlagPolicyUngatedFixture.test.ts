import { describe, expect, it } from 'vitest'

import { featureFlagPolicyUngatedFixtureBehavior } from './featureFlagPolicyUngatedFixture'

describe('featureFlagPolicyUngatedFixtureBehavior', () => {
  it('enables the candidate behavior without a rollout gate', () => {
    expect(featureFlagPolicyUngatedFixtureBehavior()).toBe('candidate')
  })
})
