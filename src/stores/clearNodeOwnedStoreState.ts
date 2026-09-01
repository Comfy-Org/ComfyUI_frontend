import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { parseNodeId } from '@/types/nodeId'

import { usePreviewExposureStore } from './previewExposureStore'
import { useWidgetValueStore } from './widgetValueStore'

/**
 * Whether a node's owned store state — specifically its widget values —
 * leaves with it. `'keep-values'` is for a node that may come back (undo of
 * a deletion); `'discard-values'` is for a node that is gone for good
 * (subgraph teardown, node replacement). Preview exposures are always
 * cleared: {@link detachNodeFromStores} in `nodeShellLifecycle.ts` drops them
 * unconditionally on the same detach.
 */
export type ClearNodeOwnedStoreStateMode = 'keep-values' | 'discard-values'

export function clearNodeOwnedStoreState(
  node: LGraphNode,
  mode: ClearNodeOwnedStoreStateMode = 'discard-values'
): void {
  const graph = node.graph
  if (!graph) return

  const rootGraphId = graph.isRootGraph ? graph.id : graph.rootGraph.id
  const nodeId = parseNodeId(node.id) ?? node.id
  if (mode === 'discard-values') {
    useWidgetValueStore().clearNode(rootGraphId, nodeId)
  }
  usePreviewExposureStore().clearHost(
    rootGraphId,
    createNodeLocatorId(
      graph.isRootGraph || graph.id === rootGraphId ? null : graph.id,
      nodeId
    )
  )
}
