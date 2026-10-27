import { computed, onScopeDispose, shallowReactive, watch } from 'vue'

import { toSelectableKey } from '@/core/selection/selectionState'
import { isSelectedIn } from '@/core/selection/selectionStore'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { registerNodeEmphasisQuery } from '@/lib/litegraph/src/nodeEmphasis'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

const referenceSources = shallowReactive(new Set<() => NodeId | undefined>())

const referencedNodeIds = computed(() => {
  const ids = new Set<NodeId>()
  for (const source of referenceSources) {
    const id = source()
    if (id !== undefined) ids.add(id)
  }
  return ids
})

/**
 * Emphasizes the node `source` names, without selecting it, for as long as
 * the calling scope lives. The caller stays the owner of the reference.
 */
export function useNodeEmphasisSource(source: () => NodeId | undefined): void {
  referenceSources.add(source)
  onScopeDispose(() => referenceSources.delete(source))
}

/**
 * Whether a node of the graph `scope` is drawn emphasized: selected there,
 * or named by an emphasis source.
 */
export function isNodeEmphasized(
  scope: GraphScope | undefined,
  nodeId: NodeId
): boolean {
  return (
    isSelectedIn(scope, toSelectableKey('node', nodeId)) ||
    referencedNodeIds.value.has(nodeId)
  )
}

function isCanvasNodeEmphasized(node: LGraphNode): boolean {
  // A node outside any graph keeps its own selection flag.
  return node.graph
    ? isNodeEmphasized(graphScopeOf(node.graph), node.id)
    : node.selected
}

/**
 * Installs {@link isNodeEmphasized} as the legacy canvas's emphasis query
 * and redraws that canvas when the referenced nodes change.
 */
export function useNodeEmphasis(): void {
  const canvasStore = useCanvasStore()
  onScopeDispose(registerNodeEmphasisQuery(isCanvasNodeEmphasized))
  watch(referencedNodeIds, () => canvasStore.canvas?.setDirty(true, false))
}
