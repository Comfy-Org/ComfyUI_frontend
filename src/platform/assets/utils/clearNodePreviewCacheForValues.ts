import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

/**
 * Clear cached Load Image / Load Video preview state on any node whose widget
 * value matches one of the given values. Covers:
 *   - the canvas renderer cache (`node.imgs`, `node.videoContainer`)
 *   - the Vue preview source — must be cleared via `removeOutputsForNode`
 *     so the Pinia reactive ref (`nodeOutputStore.nodeOutputs.value`) updates,
 *     not just the legacy `app.nodeOutputs` mirror
 *
 * Comparison is full-string against the widget value as stored — callers must
 * provide the canonical widget-value variants for each deleted asset (e.g.
 * `foo.png`, `foo.png [output]`, `sub/foo.png [output]`, `<hash>`). This
 * avoids false matches when two distinct assets share a basename across
 * input/output sources.
 *
 * Walks the full graph hierarchy via `collectAllNodes`, so Load Image / Load
 * Video nodes inside subgraphs are also matched.
 *
 * FE-230 — invoked after successful asset deletion so the Load Image / Load
 * Video node preview does not keep displaying a thumbnail for an asset that
 * no longer exists.
 */
export function clearNodePreviewCacheForValues(
  rootGraph: LGraph | Subgraph,
  deletedValues: ReadonlySet<string>,
  removeOutputsForNode: (node: LGraphNode) => void
): void {
  if (deletedValues.size === 0) return
  for (const node of findNodesReferencingValues(rootGraph, deletedValues)) {
    removeOutputsForNode(node)
    node.imgs = undefined
    node.videoContainer = undefined
    node.graph?.setDirtyCanvas(true)
  }
}

/**
 * Walk the graph hierarchy and yield each node whose widget value matches
 * one of `deletedValues`. Shared by the preview-clearing and value-clearing
 * paths.
 *
 * Subgraph wrappers are opt-in for clearing persisted promoted widget values.
 */
export function findNodesReferencingValues(
  rootGraph: LGraph | Subgraph,
  deletedValues: ReadonlySet<string>,
  { includeSubgraphNodes = false }: { includeSubgraphNodes?: boolean } = {}
): LGraphNode[] {
  if (deletedValues.size === 0) return []
  const matches: LGraphNode[] = []
  for (const node of collectAllNodes(rootGraph)) {
    if (!node.widgets?.length) continue
    if (
      !includeSubgraphNodes &&
      typeof node.isSubgraphNode === 'function' &&
      node.isSubgraphNode()
    )
      continue
    const referencesDeleted = node.widgets.some(
      (w) => typeof w.value === 'string' && deletedValues.has(w.value)
    )
    if (referencesDeleted) matches.push(node)
  }
  return matches
}
