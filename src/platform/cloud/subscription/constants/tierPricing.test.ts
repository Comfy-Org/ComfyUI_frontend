import { describe, expect, it } from 'vitest'

import type { IngestSubscriptionTier } from './tierPricing'
import { toTierKey } from './tierPricing'

describe('toTierKey', () => {
  it('maps every personal-catalog tier to its key', () => {
    expect(toTierKey('FREE')).toBe('free')
    expect(toTierKey('STANDARD')).toBe('standard')
    expect(toTierKey('CREATOR')).toBe('creator')
    expect(toTierKey('PRO')).toBe('pro')
    expect(toTierKey('FOUNDERS_EDITION')).toBe('founder')
  })

  it('returns null for workspace-level tiers', () => {
    expect(toTierKey('TEAM')).toBeNull()
  })

  // The tier arrives as unvalidated JSON from the backend, so a value outside
  // the union is reachable at runtime even though the type forbids it. It must
  // return null rather than failing, which is what keeps a backend-side tier
  // addition from breaking the frontend.
  it('returns null for a tier the frontend does not know', () => {
    expect(toTierKey('ENTERPRISE' as IngestSubscriptionTier)).toBeNull()
  })

  // hasOwnProperty rather than `in`: these are inherited from Object.prototype,
  // so `in` would return a function or object where a TierKey is expected.
  it.each(['constructor', 'toString', '__proto__', 'valueOf'])(
    'returns null for the inherited property %s',
    (key) => {
      expect(toTierKey(key as IngestSubscriptionTier)).toBeNull()
    }
  )
})
