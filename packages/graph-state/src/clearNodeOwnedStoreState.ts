import type { OwnedNode } from './graphOwner'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { parseNodeId } from '@comfyorg/graph-model/nodeId'

import { usePreviewExposureStore } from './previewExposureStore'
import { useWidgetValueStore } from './widgetValueStore'

export function clearNodeOwnedStoreState(node: OwnedNode): void {
  const graph = node.graph
  if (!graph) return

  const rootGraphId = graph.isRootGraph ? graph.id : graph.rootGraph.id
  const nodeId = parseNodeId(node.id) ?? node.id
  useWidgetValueStore().clearNode(rootGraphId, nodeId)
  usePreviewExposureStore().clearHost(
    rootGraphId,
    createNodeLocatorId(
      graph.isRootGraph || graph.id === rootGraphId ? null : graph.id,
      nodeId
    )
  )
}
