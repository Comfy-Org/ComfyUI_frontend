import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useApp } from '@/scripts/appInstance'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

export function useWidgetHostNode(
  nodeLocatorId: MaybeRefOrGetter<NodeLocatorId | undefined>,
  nodeId: MaybeRefOrGetter<NodeId>
) {
  return computed(() => {
    const locatorId = toValue(nodeLocatorId)
    const owner = locatorId && getNodeByLocatorId(useApp().rootGraph, locatorId)
    return owner || useApp().canvas.graph?.getNodeById(toValue(nodeId))
  })
}
