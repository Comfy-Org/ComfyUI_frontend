import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import {
  getPreviewExposureHostLocator,
  usePreviewExposureStore
} from '@/stores/previewExposureStore'
import type { NodeId } from '@/types/nodeId'

import type { PromotedPreview } from './usePromotedPreviews'

/**
 * A host's own first-hop exposures, keyed the same way
 * {@link getPreviewExposureHostLocator} stores them — i.e. by the host's
 * instance-scoped locator, not its bare `node.id`. The two only coincide for
 * root-level hosts; a nested host's exposures live under its definition-
 * scoped locator, so looking them up by bare id silently finds nothing.
 */
export function getHostExposedSourceNodeIds(node: SubgraphNode): NodeId[] {
  const hostLocator = getPreviewExposureHostLocator(node)
  if (!hostLocator) return []
  return usePreviewExposureStore()
    .getExposures(node.rootGraph.id, hostLocator)
    .map((exposure) => exposure.sourceNodeId)
}

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
