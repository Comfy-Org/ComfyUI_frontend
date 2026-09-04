import { describe, expect, it } from 'vitest'

import { featureFlagPolicyEffectiveLowFixture } from './featureFlagPolicyEffectiveLowFixture'

describe('featureFlagPolicyEffectiveLowFixture', () => {
  it('keeps current behavior', () => {
    expect(featureFlagPolicyEffectiveLowFixture()).toBe('current')
  })
})
