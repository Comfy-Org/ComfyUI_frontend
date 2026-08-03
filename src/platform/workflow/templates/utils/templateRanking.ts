// `searchRank` is the curator dial authored in workflow_templates, specified
// there as "0-1000, higher = better" (docs/SPEC.md). Magnitude saturates on a
// log curve so the values curators actually write — 8, 500, 1000, 1_000_000 —
// all land inside the cap instead of swamping whatever it is applied to.
const SEARCH_RANK_SATURATION = 1000

// The retired 1-10 scale used 1-4 to demote and 5 as neutral. Those magnitudes
// are noise on a 0-1000 dial, so ignoring them honours both contracts: no
// legacy value ever flips from demotion to promotion.
const SEARCH_RANK_DEAD_ZONE = 5

/**
 * Curator intent as a signed strength in [-1, 1]. Unset, non-numeric, and any
 * rank within the dead zone are the same neutral baseline — most of the catalog
 * ships an explicit `"searchRank": 0` meaning "not curated", so 0 must not
 * demote. Promotion starts once the rank exceeds the dead zone and demotion
 * once it falls below the negative of it, each saturating at the cap.
 */
export function searchRankBoost(searchRank: number | undefined): number {
  if (!searchRank || Math.abs(searchRank) <= SEARCH_RANK_DEAD_ZONE) return 0
  const magnitude = Math.min(
    1,
    Math.log1p(Math.abs(searchRank)) / Math.log1p(SEARCH_RANK_SATURATION)
  )
  return Math.sign(searchRank) * magnitude
}
