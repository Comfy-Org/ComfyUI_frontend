import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { app } from '@/scripts/app'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

export function useWidgetHostNode(
  nodeLocatorId: MaybeRefOrGetter<NodeLocatorId | undefined>,
  nodeId: MaybeRefOrGetter<NodeId>
) {
  return computed(() => {
    const locatorId = toValue(nodeLocatorId)
    const owner = locatorId && getNodeByLocatorId(app.rootGraph, locatorId)
    return owner || app.canvas.graph?.getNodeById(toValue(nodeId))
  })
}
