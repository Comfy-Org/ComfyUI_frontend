import { useThrottleFn } from '@vueuse/core'
import { shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'
import { boundsIntersect } from '@/renderer/core/layout/utils/layoutMath'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import {
  getCullingOptOutVersion,
  isNodeTypeExcludedFromCulling
} from '@/services/vueNodeCullingService'

const MIN_NODES_FOR_KEEP_ALIVE = 150
const KEEP_ALIVE_EXIT_RATIO = 0.9
const VIEWPORT_MARGIN_RATIO = 0.5
const MAX_MARGIN_GRAPH_UNITS = 2000
const REFRESH_THROTTLE_MS = 100

interface Size {
  width: number
  height: number
}

interface Camera {
  x: number
  y: number
  z: number
}

interface UseViewportKeepAliveOptions {
  nodeIds: ComputedRef<NodeId[]>
  getNodeType: (nodeId: NodeId) => string | undefined
  pinnedNodeIds: ComputedRef<ReadonlySet<NodeId>>
  /**
   * Support escape hatch. A getter so the composable has a reactive dependency
   * on it: read inside plain callbacks alone, turning it back on would not
   * recompute the set, and turning it off would leave whatever was last
   * computed in place rather than attaching everything.
   */
  isEnabled?: () => boolean
  getNodeBounds: (nodeId: NodeId) => Bounds | null
  getViewportSize: () => Size
  getGeometryVersion: () => number
}

export function getKeepAliveBounds(camera: Camera, viewport: Size): Bounds {
  const scale = camera.z || 1
  const marginX = Math.min(
    (viewport.width * VIEWPORT_MARGIN_RATIO) / scale,
    MAX_MARGIN_GRAPH_UNITS
  )
  const marginY = Math.min(
    (viewport.height * VIEWPORT_MARGIN_RATIO) / scale,
    MAX_MARGIN_GRAPH_UNITS
  )

  return {
    x: -marginX - camera.x,
    y: -marginY - camera.y,
    width: viewport.width / scale + marginX * 2,
    height: viewport.height / scale + marginY * 2 + LiteGraph.NODE_TITLE_HEIGHT
  }
}

function isUsableBounds(bounds: Bounds): boolean {
  return (
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width >= 0 &&
    bounds.height >= 0
  )
}

function setsEqual<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

export function useViewportKeepAlive({
  nodeIds,
  getNodeType,
  pinnedNodeIds,
  isEnabled = () => true,
  getNodeBounds,
  getViewportSize,
  getGeometryVersion
}: UseViewportKeepAliveOptions) {
  const { camera } = useTransformState()
  const activeNodeIds = shallowRef<Set<NodeId>>(new Set())
  let keepAliveActive = false

  function refresh(): void {
    const ids = nodeIds.value
    keepAliveActive =
      isEnabled() &&
      (keepAliveActive
        ? ids.length >= MIN_NODES_FOR_KEEP_ALIVE * KEEP_ALIVE_EXIT_RATIO
        : ids.length >= MIN_NODES_FOR_KEEP_ALIVE)

    if (!keepAliveActive) {
      const next = new Set(ids)
      if (!setsEqual(next, activeNodeIds.value)) activeNodeIds.value = next
      return
    }

    const viewport = getViewportSize()
    if (viewport.width <= 0 || viewport.height <= 0) return

    const viewportBounds = getKeepAliveBounds(camera, viewport)
    const next = new Set<NodeId>()
    for (const nodeId of ids) {
      // Admission for registered types: an extension has said detaching this
      // node from the document destroys state its component cannot keep - a
      // canvas context, an uncontrolled editor. Always attached, wherever it
      // is. Bounded by the registrant, not the graph, so unlike the pins below
      // it is safe to admit.
      const nodeType = getNodeType(nodeId)
      if (nodeType && isNodeTypeExcludedFromCulling(nodeType)) {
        next.add(nodeId)
        continue
      }
      const bounds = getNodeBounds(nodeId)
      if (
        !bounds ||
        !isUsableBounds(bounds) ||
        boundsIntersect(bounds, viewportBounds)
      ) {
        next.add(nodeId)
      }
    }

    // Retention, not admission: a pin keeps an attached node attached while
    // the pin holds, and nothing more. A pinned node that is already detached
    // stays detached - focus, playing media and a link drag can only exist on
    // an attached node, so admission would never be needed, and it is what
    // would let a graph-sized pin mount the graph. Retention expires with the
    // pin because this set is rebuilt from the viewport on every refresh.
    for (const nodeId of pinnedNodeIds.value) {
      if (activeNodeIds.value.has(nodeId)) next.add(nodeId)
    }

    if (!setsEqual(next, activeNodeIds.value)) activeNodeIds.value = next
  }

  const refreshThrottled = useThrottleFn(refresh, REFRESH_THROTTLE_MS, true)

  watch(nodeIds, refresh, { immediate: true })
  watch(
    () => [camera.x, camera.y, camera.z],
    () => void refreshThrottled()
  )
  watch(
    () => {
      const viewport = getViewportSize()
      return [viewport.width, viewport.height]
    },
    () => void refreshThrottled()
  )
  watch(pinnedNodeIds, () => void refreshThrottled())
  watch(isEnabled, refresh)
  // An extension can register an opt-out at any time, typically at load. The
  // registered nodes must attach on registration, not on the next pan.
  watch(getCullingOptOutVersion, () => void refreshThrottled())

  watch(getGeometryVersion, () => void refreshThrottled())

  return { activeNodeIds }
}
