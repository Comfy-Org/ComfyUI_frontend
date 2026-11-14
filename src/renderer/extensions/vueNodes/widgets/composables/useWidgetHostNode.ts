import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLiveGraphNode } from '@/composables/useLiveGraphNode'
import { app } from '@/scripts/app'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { getNodeByLocatorId, getNodeByState } from '@/utils/graphTraversalUtil'

export function useWidgetHostNode(
  nodeLocatorId: MaybeRefOrGetter<NodeLocatorId | undefined>,
  nodeId: MaybeRefOrGetter<NodeId>
) {
  const canvasStore = useCanvasStore()
  const nodeDataStore = useNodeDataStore()
  return useLiveGraphNode(() => {
    const locatorId = toValue(nodeLocatorId)
    const owner = locatorId && getNodeByLocatorId(app.rootGraph, locatorId)
    if (owner) return owner
    const { rootGraphId } = canvasStore
    if (!rootGraphId) return undefined
    const state = nodeDataStore.getNode(rootGraphId, toValue(nodeId))
    return state && getNodeByState(app.rootGraph, state)
  })
}
