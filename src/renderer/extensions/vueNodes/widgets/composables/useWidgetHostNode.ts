import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'
import type { NodeLocatorId } from '@/types/nodeIdentification'
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
