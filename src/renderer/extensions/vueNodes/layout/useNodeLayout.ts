import { computed, onUnmounted, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { Point } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'

/**
 * Composable for individual Vue node components
 * Uses customRef for shared write access with Canvas renderer
 */
export function useNodeLayout(nodeIdMaybe: MaybeRefOrGetter<NodeId>) {
  const nodeId = toValue(nodeIdMaybe)
  const mutations = useLayoutMutations()
  const canvasStore = useCanvasStore()

  // The layout entry for this node in the graph currently being viewed
  const layout = computed(() => {
    const { rootGraphId } = canvasStore
    return rootGraphId
      ? layoutStore.getNodeLayoutRef(rootGraphId, nodeId).value
      : null
  })

  // Clean up refs and triggers when Vue component unmounts
  onUnmounted(() => {
    const { rootGraphId } = canvasStore
    if (rootGraphId) layoutStore.cleanupNodeRef(rootGraphId, nodeId)
  })

  // Computed properties for easy access
  const position = computed(() => layout.value?.position ?? { x: 0, y: 0 })
  const size = computed(() => layout.value?.size ?? { width: 200, height: 100 })

  const zIndex = computed(() => layout.value?.zIndex ?? 0)

  /**
   * Update node position directly (without drag)
   */
  function moveNodeTo(position: Point) {
    const { rootGraphId } = canvasStore
    if (!rootGraphId) return

    mutations.setSource(LayoutSource.Vue)
    mutations.moveNode(rootGraphId, nodeId, position)
  }

  return {
    // Reactive state (via customRef)
    position,
    size,
    zIndex,

    // Mutations
    moveNodeTo
  }
}
