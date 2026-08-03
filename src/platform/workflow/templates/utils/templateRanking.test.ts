import { describe, expect, it } from 'vitest'

import { searchRankBoost } from '@/platform/workflow/templates/utils/templateRanking'

describe('searchRankBoost', () => {
  // Most of the catalog ships an explicit `"searchRank": 0` from tooling, so 0
  // must mean the same thing as an absent field, not a demotion.
  it('treats unset, zero and non-numeric ranks as the same neutral baseline', () => {
    expect(searchRankBoost(undefined)).toBe(0)
    expect(searchRankBoost(0)).toBe(0)
    expect(searchRankBoost(Number.NaN)).toBe(0)
  })

  it('promotes on positive and demotes on negative, symmetrically', () => {
    expect(searchRankBoost(8)).toBeGreaterThan(0)
    expect(searchRankBoost(-8)).toBeCloseTo(-searchRankBoost(8), 10)
  })

  // The dead zone exists because the retired 1-10 scale read 1-4 as "demote"
  // and 5 as "neutral", and the starter templates still ship searchRank 3.
  // Reading those as a promotion would invert their authors' only intent.
  it('stays neutral inside the dead zone and engages just outside it', () => {
    for (const insideDeadZone of [1, 2, 3, 4, 5, -1, -5]) {
      expect(searchRankBoost(insideDeadZone)).toBe(0)
    }
    expect(searchRankBoost(6)).toBeGreaterThan(0)
    expect(searchRankBoost(-6)).toBeLessThan(0)
  })

  it('increases with rank but saturates so out-of-range values stay bounded', () => {
    expect(searchRankBoost(1000)).toBeGreaterThan(searchRankBoost(8))
    expect(searchRankBoost(1_000_000)).toBe(1)
    expect(searchRankBoost(Number.MAX_SAFE_INTEGER)).toBe(1)
    expect(searchRankBoost(-1_000_000)).toBe(-1)
  })
})
