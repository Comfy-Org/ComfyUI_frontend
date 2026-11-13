import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLiveGraphNode } from '@/composables/useLiveGraphNode'
import { app } from '@/scripts/app'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

export function useWidgetHostNode(
  nodeLocatorId: MaybeRefOrGetter<NodeLocatorId | undefined>,
  nodeId: MaybeRefOrGetter<NodeId>
) {
  const canvasStore = useCanvasStore()
  return useLiveGraphNode(() => {
    const graph = canvasStore.currentGraph ?? app.canvas.graph
    const locatorId = toValue(nodeLocatorId)
    const owner = locatorId && getNodeByLocatorId(app.rootGraph, locatorId)
    return owner || graph?.getNodeById(toValue(nodeId))
  })
}
