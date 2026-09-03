import { describe, expect, it } from 'vitest'

import type { IngestSubscriptionTier } from './tierPricing'
import {
  hasActivePaidPlan,
  isEnterprisePlanSlug,
  isSalesManagedTier,
  isUnknownTier,
  toTierKey
} from './tierPricing'

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
    expect(toTierKey('ENTERPRISE')).toBeNull()
  })

  // The tier arrives as unvalidated JSON from the backend, so a value outside
  // the union is reachable at runtime even though the type forbids it. It must
  // return null rather than failing, which is what keeps a backend-side tier
  // addition from breaking the frontend.
  it('returns null for a tier the frontend does not know', () => {
    expect(toTierKey('SOME_FUTURE_TIER' as IngestSubscriptionTier)).toBeNull()
  })

  // hasOwnProperty rather than `in`: these are inherited from Object.prototype,
  // so `in` would return a function or object where a TierKey is expected.
  it.for(['constructor', 'toString', '__proto__', 'valueOf'])(
    'returns null for the inherited property %s',
    (key) => {
      expect(toTierKey(key as IngestSubscriptionTier)).toBeNull()
    }
  )

  // tier is unvalidated backend JSON, so a non-string is reachable. These must
  // return null rather than coercing to a property key or throwing.
  it.for([[['FREE']], [{}], [null], [undefined], [42]])(
    'returns null for the non-string value %s',
    ([value]) => {
      expect(toTierKey(value as unknown as IngestSubscriptionTier)).toBeNull()
    }
  )
})

describe('hasActivePaidPlan', () => {
  // Deliberately not keyed off toTierKey: workspace-level tiers map to no
  // catalog key yet are paid plans, so a null key must not read as unpaid.
  it('treats catalog, workspace-level, and unrecognised tiers as paid', () => {
    expect(hasActivePaidPlan('PRO')).toBe(true)
    expect(hasActivePaidPlan('TEAM')).toBe(true)
    expect(hasActivePaidPlan('ENTERPRISE')).toBe(true)
  })

  it('treats FREE and an absent tier as unpaid', () => {
    expect(hasActivePaidPlan('FREE')).toBe(false)
    expect(hasActivePaidPlan(null)).toBe(false)
    expect(hasActivePaidPlan(undefined)).toBe(false)
  })
})

describe('isEnterprisePlanSlug', () => {
  it('matches enterprise slugs in either case', () => {
    expect(isEnterprisePlanSlug('enterprise_monthly')).toBe(true)
    expect(isEnterprisePlanSlug('ENTERPRISE_ANNUAL')).toBe(true)
  })

  it('rejects catalog slugs and absent values', () => {
    expect(isEnterprisePlanSlug('team-monthly')).toBe(false)
    expect(isEnterprisePlanSlug(null)).toBe(false)
    expect(isEnterprisePlanSlug(undefined)).toBe(false)
  })
})

describe('isUnknownTier', () => {
  it('flags only tiers outside the catalog and the workspace-level set', () => {
    expect(isUnknownTier('GALACTIC' as unknown as IngestSubscriptionTier)).toBe(
      true
    )
    expect(isUnknownTier('PRO')).toBe(false)
    expect(isUnknownTier('TEAM')).toBe(false)
    expect(isUnknownTier('ENTERPRISE')).toBe(false)
    expect(isUnknownTier(null)).toBe(false)
    expect(isUnknownTier(undefined)).toBe(false)
  })
})

describe('isSalesManagedTier', () => {
  it('covers Enterprise and unrecognised tiers, nothing else', () => {
    expect(isSalesManagedTier('ENTERPRISE')).toBe(true)
    expect(
      isSalesManagedTier('GALACTIC' as unknown as IngestSubscriptionTier)
    ).toBe(true)
    expect(isSalesManagedTier('PRO')).toBe(false)
    expect(isSalesManagedTier('TEAM')).toBe(false)
    expect(isSalesManagedTier(null)).toBe(false)
  })
})
