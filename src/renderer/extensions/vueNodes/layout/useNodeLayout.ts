import { computed, shallowRef, toValue, watch } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeLayout, Point } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'

/**
 * Composable for individual Vue node components
 * Uses customRef for shared write access with Canvas renderer
 */
export function useNodeLayout(nodeIdMaybe: MaybeRefOrGetter<NodeId>) {
  const nodeId = toValue(nodeIdMaybe)
  const mutations = useLayoutMutations(LayoutSource.Vue)
  const canvasStore = useCanvasStore()

  const layoutRef = shallowRef<ComputedRef<NodeLayout | null> | null>(null)
  watch(
    () => canvasStore.rootGraphId,
    (rootGraphId) => {
      if (!rootGraphId) {
        layoutRef.value = null
        return
      }

      layoutRef.value = layoutStore.getNodeLayoutRef(rootGraphId, nodeId)
    },
    { immediate: true }
  )

  const layout = computed(() => layoutRef.value?.value ?? null)

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
