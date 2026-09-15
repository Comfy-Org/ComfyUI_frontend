// Ceiling of the authored 0-1000 range (workflow_templates docs/SPEC.md).
const SEARCH_RANK_SATURATION = 1000

// Spans the retired 1-10 scale's demote band; no legacy value flips to promote.
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
