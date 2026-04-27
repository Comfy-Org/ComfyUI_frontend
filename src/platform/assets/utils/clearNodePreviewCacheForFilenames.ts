import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

/**
 * Clear cached Load Image preview state on any node whose widget value
 * references one of the given filenames. Covers the canvas renderer cache
 * (`node.imgs`) and the Vue preview source (`app.nodeOutputs[locatorId]`),
 * and marks the node's graph dirty so the canvas redraws.
 *
 * FE-230 — invoked after successful asset deletion so the Load Image node
 * preview does not keep displaying a thumbnail for an asset that no longer
 * exists.
 */
export function clearNodePreviewCacheForFilenames(
  graph: LGraph,
  deletedFilenames: ReadonlySet<string>,
  nodeToLocatorId: (node: LGraphNode) => string | null
): void {
  if (deletedFilenames.size === 0) return
  const nodes = graph._nodes ?? []
  for (const node of nodes) {
    const matches = node.widgets?.some(
      (w) => typeof w.value === 'string' && deletedFilenames.has(w.value)
    )
    if (!matches) continue
    const locatorId = nodeToLocatorId(node)
    if (locatorId) delete app.nodeOutputs[locatorId]
    node.imgs = undefined
    node.graph?.setDirtyCanvas(true)
  }
}
