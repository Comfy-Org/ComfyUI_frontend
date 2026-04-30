import { computed, onUnmounted, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

/**
 * Composable for individual Vue node components
 * Uses customRef for shared write access with Canvas renderer
 */
export function useNodeLayout(nodeIdMaybe: MaybeRefOrGetter<string>) {
  const nodeId = toValue(nodeIdMaybe)

  // Get the customRef for this node (shared write access)
  const layoutRef = layoutStore.getNodeLayoutRef(nodeId)

  // Clean up refs and triggers when Vue component unmounts
  onUnmounted(() => {
    layoutStore.cleanupNodeRef(nodeId)
  })

  // Computed properties for easy access
  const position = computed(() => {
    const layout = layoutRef.value
    const pos = layout?.position ?? { x: 0, y: 0 }
    return pos
  })
  const size = computed(
    () => layoutRef.value?.size ?? { width: 200, height: 100 }
  )

  const zIndex = computed(() => layoutRef.value?.zIndex ?? 0)

  return {
    position,
    size,
    zIndex
  }
}
