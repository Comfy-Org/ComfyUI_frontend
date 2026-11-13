import { computed, shallowRef, toValue, watch } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeLayout } from '@comfyorg/graph-model/layout'
import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

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

  const position = shallowRef(layout.value?.position ?? { x: 0, y: 0 })
  watch(
    [
      () => layout.value?.position.x ?? 0,
      () => layout.value?.position.y ?? 0,
      () => canvasStore.canvas
    ],
    ([x, y, canvas], _, onCleanup) => {
      if (!canvas) {
        position.value = { x, y }
        return
      }
      const stop = onCanvasFrame(canvas.canvas, 'present', () => {
        position.value = { x, y }
        stop()
      })
      canvas.setDirty(true, true)
      onCleanup(stop)
    },
    { flush: 'sync' }
  )
  const size = computed(() => layout.value?.size ?? { width: 200, height: 100 })

  const zIndex = computed(() => layout.value?.zIndex ?? 0)

  function moveNodeTo(position: Point) {
    const { rootGraphId } = canvasStore
    if (!rootGraphId) return

    mutations.moveNode(rootGraphId, nodeId, position)
  }

  return {
    position,
    size,
    zIndex,

    moveNodeTo
  }
}
