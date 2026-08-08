import type { NodeId } from '@/types/nodeId'

import type { PromotedPreview } from './usePromotedPreviews'

/**
 * Merges a subgraph host's exposure-promoted previews with its ambient
 * previews, keeping the promoted entry whenever both cover the same
 * interior node.
 *
 * `exposedSourceNodeIds` must be the host's own first-hop exposures (e.g.
 * from `previewExposureStore.getExposures(rootGraphId, hostLocator)`), not
 * `promoted`'s resolved `sourceNodeId`s. A promoted preview's `sourceNodeId`
 * can be a leaf id resolved through a nested subgraph, which lives in a
 * different `LGraph`'s id space than `ambient`'s immediate-interior ids —
 * deduping against it can drop an unrelated ambient node that happens to
 * share the same numeric id one level down.
 */
export function mergeSubgraphPreviews(
  promoted: readonly PromotedPreview[],
  ambient: readonly PromotedPreview[],
  exposedSourceNodeIds: readonly NodeId[]
): PromotedPreview[] {
  if (!ambient.length) return [...promoted]

  const exposed = new Set(exposedSourceNodeIds.map(String))
  const unexposed = ambient.filter(
    (preview) => !exposed.has(String(preview.sourceNodeId))
  )
  return [...promoted, ...unexposed]
}
