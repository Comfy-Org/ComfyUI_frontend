/**
 * Viewport culling for Vue node components.
 *
 * Only nodes intersecting the expanded viewport are kept mounted in the DOM.
 * Nodes are mounted as soon as they enter, and unmounted after a short delay
 * once they leave, so nodes oscillating on the viewport edge during a pan do
 * not thrash mount/unmount.
 *
 * Recomputation is throttled and the result is exposed as a `Set` that changes
 * at most once per throttle window. Camera state is sampled imperatively rather
 * than tracked reactively, so the rendered node list never becomes a per-frame
 * reactive dependency of the camera.
 */
import { useDebounceFn, useEventListener, useThrottleFn } from '@vueuse/core'
import { shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'

/** Extra coverage beyond each viewport edge, as a fraction of viewport size. */
const VIEWPORT_MARGIN_RATIO = 0.5

/**
 * Ceiling on the margin, in graph units.
 *
 * The ratio above is screen-relative, so dividing it by the zoom makes the
 * margin cover more and more of the graph as the user zooms out - at minimum
 * zoom it more than doubles the queried area, pulling in far more nodes than a
 * pan could reach before the next recompute. Roughly five node widths is ample
 * lead time at any zoom.
 */
const MAX_MARGIN_GRAPH_UNITS = 2000

/** Grace period before unmounting nodes that left the viewport. */
const UNMOUNT_DELAY_MS = 250

/** Minimum interval between visibility recomputations during pan/zoom. */
const RECOMPUTE_THROTTLE_MS = 100

/**
 * Extra mounted nodes tolerated before pruning eagerly, so small graphs are
 * not pruned on every recompute.
 */
const PRUNE_SLACK = 8

interface Size {
  width: number
  height: number
}

interface Camera {
  x: number
  y: number
  z: number
}

/**
 * Expanded viewport rect in graph coordinates.
 *
 * Screen space maps to graph space as `graph = screen / z - offset`, matching
 * the transform applied by TransformPane.
 */
export function getCullingBounds(
  camera: Camera,
  viewport: Size,
  marginRatio = VIEWPORT_MARGIN_RATIO
): Bounds {
  const scale = camera.z || 1
  const marginX = Math.min(
    (viewport.width * marginRatio) / scale,
    MAX_MARGIN_GRAPH_UNITS
  )
  const marginY = Math.min(
    (viewport.height * marginRatio) / scale,
    MAX_MARGIN_GRAPH_UNITS
  )

  return {
    x: -marginX - camera.x,
    y: -marginY - camera.y,
    width: viewport.width / scale + marginX * 2,
    height: viewport.height / scale + marginY * 2
  }
}

interface UseViewportCullingOptions {
  nodes: ComputedRef<VueNodeData[]>
  /** Ids whose bounds intersect the given graph-space rect. */
  queryNodesInBounds: (bounds: Bounds) => Iterable<NodeId>
  getViewportSize: () => Size
  /**
   * Nodes that must stay mounted regardless of position, so that unmounting
   * never interrupts an interaction that is already in progress.
   */
  isPinned?: (id: NodeId) => boolean
}

export function useViewportCulling({
  nodes,
  queryNodesInBounds,
  getViewportSize,
  isPinned
}: UseViewportCullingOptions) {
  const { camera } = useTransformState()
  const mountedNodeIds = shallowRef<Set<NodeId>>(new Set())

  function computeVisibleNodeIds(): Set<NodeId> {
    const visible = new Set<NodeId>()
    const viewport = getViewportSize()

    if (!viewport.width || !viewport.height) {
      for (const node of nodes.value) visible.add(node.id)
      return visible
    }

    for (const id of queryNodesInBounds(getCullingBounds(camera, viewport))) {
      visible.add(id)
    }

    if (isPinned) {
      for (const node of nodes.value) {
        if (isPinned(node.id)) visible.add(node.id)
      }
    }

    return visible
  }

  const pruneMountedNodes = useDebounceFn(() => {
    mountedNodeIds.value = computeVisibleNodeIds()
  }, UNMOUNT_DELAY_MS)

  function refreshMountedNodes() {
    const visible = computeVisibleNodeIds()
    const mounted = mountedNodeIds.value

    let hasEntered = false
    for (const id of visible) {
      if (!mounted.has(id)) {
        hasEntered = true
        break
      }
    }

    let hasLeft = false
    for (const id of mounted) {
      if (!visible.has(id)) {
        hasLeft = true
        break
      }
    }

    if (hasEntered) {
      const next = new Set(mounted)
      for (const id of visible) next.add(id)
      mountedNodeIds.value = next
    }

    if (!hasLeft) return

    // The debounced prune only runs once panning settles, so a long
    // continuous pan would otherwise keep every node it swept over mounted.
    // Once the mounted set is much larger than what is actually visible,
    // drop the stale entries immediately instead of waiting.
    if (mounted.size > visible.size * 2 + PRUNE_SLACK) {
      mountedNodeIds.value = visible
      return
    }

    void pruneMountedNodes()
  }

  const refreshThrottled = useThrottleFn(
    refreshMountedNodes,
    RECOMPUTE_THROTTLE_MS,
    true
  )

  watch(nodes, refreshMountedNodes, { immediate: true })

  watch(
    () => [camera.x, camera.y, camera.z],
    () => void refreshThrottled()
  )

  useEventListener(window, 'resize', refreshMountedNodes)

  return { mountedNodeIds }
}
