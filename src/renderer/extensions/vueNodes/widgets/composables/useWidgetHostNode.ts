import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

export function useWidgetHostNode(
  widget: MaybeRefOrGetter<Pick<SimplifiedWidget, 'nodeLocatorId'>>,
  nodeId: MaybeRefOrGetter<NodeId>
): ComputedRef<LGraphNode | null | undefined> {
  return computed(() => {
    const locatorId = toValue(widget).nodeLocatorId
    const owner = locatorId
      ? getNodeByLocatorId(app.rootGraph, locatorId)
      : null
    return owner ?? app.canvas.graph?.getNodeById(toValue(nodeId))
  })
}
