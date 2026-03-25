/**
 * Viewport Culling for Vue Node Components
 *
 * Controls which nodes are mounted as Vue components based on viewport
 * visibility. Nodes entering the viewport are mounted immediately; nodes
 * leaving are unmounted after a debounce delay to avoid mount/unmount
 * churn when nodes oscillate at the viewport edge during panning.
 *
 * Visibility checks are throttled during active pan/zoom interactions
 * to avoid turning culling into a per-frame reactive hotspot.
 */
import { useDebounceFn, useEventListener, useThrottleFn } from '@vueuse/core'
import { shallowRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { NodeId, NodeLayout } from '@/renderer/core/layout/types'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

/** Viewport margin as a fraction of viewport dimensions (0.75 = 75% extra) */
const VIEWPORT_MARGIN = 0.75

/** Delay before unmounting nodes that left the viewport */
const HIDE_DELAY_MS = 250

/** Throttle interval for visibility recomputation during pan/zoom */
const CULL_THROTTLE_MS = 96

interface UseViewportCullingOptions {
  rawNodes: ComputedRef<VueNodeData[]>
  nodeLayouts: ComputedRef<ReadonlyMap<NodeId, NodeLayout>>
  getViewportSize: () => { width: number; height: number }
  isTransforming: Ref<boolean>
}

export function useViewportCulling({
  rawNodes,
  nodeLayouts,
  getViewportSize,
  isTransforming
}: UseViewportCullingOptions) {
  const { isNodeInViewport } = useTransformState()
  const mountedNodeIds = shallowRef(new Set<string>())

  function computeVisibleNodeIds(): Set<string> {
    const viewport = getViewportSize()
    const layouts = nodeLayouts.value
    const visible = new Set<string>()

    if (!viewport.width || !viewport.height) {
      for (const node of rawNodes.value) visible.add(node.id)
      return visible
    }

    for (const node of rawNodes.value) {
      const layout = layouts.get(node.id)

      if (!layout) {
        visible.add(node.id)
        continue
      }

      if (
        isNodeInViewport(
          [layout.position.x, layout.position.y],
          [layout.size.width, layout.size.height],
          viewport,
          VIEWPORT_MARGIN
        )
      ) {
        visible.add(node.id)
      }
    }

    return visible
  }

  const pruneMountedNodes = useDebounceFn(() => {
    mountedNodeIds.value = computeVisibleNodeIds()
  }, HIDE_DELAY_MS)

  function refreshMountedNodes() {
    const visibleNow = computeVisibleNodeIds()
    const current = mountedNodeIds.value

    let hasNewNodes = false
    let needsPrune = false
    let next = current

    for (const id of visibleNow) {
      if (!current.has(id)) {
        if (next === current) next = new Set(current)
        next.add(id)
        hasNewNodes = true
      }
    }

    for (const id of current) {
      if (!visibleNow.has(id)) {
        needsPrune = true
        break
      }
    }

    if (hasNewNodes) {
      mountedNodeIds.value = next
    }

    if (needsPrune) {
      void pruneMountedNodes()
    }
  }

  const refreshThrottled = useThrottleFn(refreshMountedNodes, CULL_THROTTLE_MS)

  watch([rawNodes, nodeLayouts], refreshMountedNodes, { immediate: true })

  const { camera } = useTransformState()
  watch(
    () => [camera.x, camera.y, camera.z] as const,
    () => {
      if (isTransforming.value) {
        void refreshThrottled()
      }
    }
  )

  watch(isTransforming, (moving) => {
    if (!moving) {
      refreshMountedNodes()
    }
  })

  useEventListener(window, 'resize', refreshMountedNodes)

  return {
    mountedNodeIds
  }
}
