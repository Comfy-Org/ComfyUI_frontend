import { computed, inject } from 'vue'
import type { ComputedRef, InjectionKey } from 'vue'

import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { getNodeByState } from '@/utils/graphTraversalUtil'

export const WidgetRenderOwnerKey: InjectionKey<
  ComputedRef<NodeState | undefined>
> = Symbol('widgetRenderOwner')

export function useWidgetRenderOwner(nodeId: () => NodeId) {
  const owner = inject(WidgetRenderOwnerKey, undefined)
  const canvasStore = useCanvasStore()
  return computed(() => {
    const graph = canvasStore.currentGraph ?? canvasStore.canvas?.graph
    if (owner) {
      return graph && owner.value
        ? (getNodeByState(graph.rootGraph, owner.value) ?? undefined)
        : undefined
    }
    return graph?.getNodeById(nodeId()) ?? undefined
  })
}
