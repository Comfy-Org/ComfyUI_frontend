import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLiveGraphNode } from '@/composables/useLiveGraphNode'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { getNodeByLocatorId, getNodeByState } from '@/utils/graphTraversalUtil'

export function useWidgetHostNode(
  nodeId: MaybeRefOrGetter<NodeId>,
  nodeLocatorId?: MaybeRefOrGetter<NodeLocatorId | undefined>
) {
  const canvasStore = useCanvasStore()
  const nodeDataStore = useNodeDataStore()
  return useLiveGraphNode(() => {
    const root = canvasStore.currentGraph?.rootGraph
    if (!root) return undefined
    const locatorId = toValue(nodeLocatorId)
    const owner = locatorId && getNodeByLocatorId(root, locatorId)
    if (owner) return owner
    const state = nodeDataStore.getNode(root.id, toValue(nodeId))
    return state && getNodeByState(root, state)
  })
}
