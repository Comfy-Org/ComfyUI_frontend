import { useElementBounding, useEventListener } from '@vueuse/core'
import { effectScope, watch } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { RectTarget } from '@/platform/onboarding/coachmarkRegistry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { registerNodeCullingOptOut } from '@/services/vueNodeCullingService'
import type { NodeId } from '@/types/nodeId'

/** A canvas node as a coachmark target, derived from its layout and the camera. */
export function canvasNodeTarget(nodeId: NodeId): RectTarget {
  const { camera } = useTransformState()
  const canvasStore = useCanvasStore()
  const releaseCullingOptOut = registerNodeCullingOptOut(nodeId)
  const resolvedGraph = canvasStore.currentGraph
  const scope = effectScope(true)
  const layout = resolvedGraph
    ? scope.run(() =>
        layoutStore.getNodeLayoutRef(resolvedGraph.rootGraph.id, nodeId)
      )
    : null
  const canvasBounds = scope.run(() =>
    useElementBounding(() => canvasStore.canvas?.canvas)
  )!

  return {
    getRect: () => {
      // Node ids are graph-local, so id 6 in another graph is a different node.
      if (canvasStore.currentGraph !== resolvedGraph) return null
      // A collapsed node renders no widget for a step to point at.
      if (canvasStore.currentGraph?.getNodeById(nodeId)?.collapsed) return null

      const bounds = layout?.value?.bounds
      if (!bounds) return null

      // Bounds are the body box; the node renders a title height above it.
      const title = LiteGraph.NODE_TITLE_HEIGHT || 0
      const { x, y, z } = camera
      return new DOMRect(
        (bounds.x + x) * z + canvasBounds.left.value,
        (bounds.y - title + y) * z + canvasBounds.top.value,
        bounds.width * z,
        (bounds.height + title) * z
      )
    },
    onMove: (notify) => {
      const stopWatch = watch(
        () => [camera.x, camera.y, camera.z, layout?.value],
        notify,
        { flush: 'post' }
      )
      const stopResize = useEventListener(window, 'resize', notify)
      return () => {
        stopWatch()
        stopResize()
      }
    },
    dispose: () => {
      releaseCullingOptOut()
      scope.stop()
    }
  }
}
