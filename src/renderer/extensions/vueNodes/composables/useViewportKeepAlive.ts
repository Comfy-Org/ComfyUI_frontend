import { useThrottleFn } from '@vueuse/core'
import { shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/renderer/core/layout/types'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { Bounds } from '@comfyorg/shared-frontend-utils/geometry'
import { boundsIntersect } from '@/renderer/core/layout/utils/layoutMath'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import {
  getCullingOptOuts,
  isNodeExcludedFromCulling
} from '@/services/vueNodeCullingService'

const MIN_NODES_FOR_KEEP_ALIVE = 150
const KEEP_ALIVE_EXIT_RATIO = 0.9
const VIEWPORT_MARGIN_RATIO = 0.5
const MAX_MARGIN_GRAPH_UNITS = 2000
const REFRESH_THROTTLE_MS = 100

type Size = Pick<Bounds, 'width' | 'height'>
type Camera = ReturnType<typeof useTransformState>['camera']

interface UseViewportKeepAliveOptions {
  nodes: ComputedRef<readonly Pick<NodeState, 'id' | 'type'>[]>
  pinnedNodeIds: ComputedRef<ReadonlySet<NodeId>>
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
  nodes,
  pinnedNodeIds,
  isEnabled = () => true,
  getNodeBounds,
  getViewportSize,
  getGeometryVersion
}: UseViewportKeepAliveOptions) {
  const { camera } = useTransformState()
  const activeNodeIds = shallowRef<Set<NodeId>>(new Set())
  let keepAliveActive = false

  function getViewportActiveNodeIds(viewportBounds: Bounds) {
    const next = new Set<NodeId>()
    for (const { id, type } of nodes.value) {
      const bounds = getNodeBounds(id)
      if (
        isNodeExcludedFromCulling(id, type) ||
        !bounds ||
        !isUsableBounds(bounds) ||
        boundsIntersect(bounds, viewportBounds)
      ) {
        next.add(id)
      }
    }

    for (const nodeId of pinnedNodeIds.value) {
      if (activeNodeIds.value.has(nodeId)) next.add(nodeId)
    }
    return next
  }

  function refresh(): void {
    keepAliveActive =
      isEnabled() &&
      (keepAliveActive
        ? nodes.value.length >= MIN_NODES_FOR_KEEP_ALIVE * KEEP_ALIVE_EXIT_RATIO
        : nodes.value.length >= MIN_NODES_FOR_KEEP_ALIVE)

    if (!keepAliveActive) {
      const next = new Set(nodes.value.map(({ id }) => id))
      if (!setsEqual(next, activeNodeIds.value)) activeNodeIds.value = next
      return
    }

    const viewport = getViewportSize()
    if (viewport.width <= 0 || viewport.height <= 0) return

    const viewportBounds = getKeepAliveBounds(camera, viewport)
    const next = getViewportActiveNodeIds(viewportBounds)

    if (!setsEqual(next, activeNodeIds.value)) activeNodeIds.value = next
  }

  const refreshThrottled = useThrottleFn(refresh, REFRESH_THROTTLE_MS, true)

  watch([nodes, isEnabled], refresh, { immediate: true })
  watch(
    [
      () => [camera.x, camera.y, camera.z],
      getViewportSize,
      pinnedNodeIds,
      getCullingOptOuts,
      getGeometryVersion
    ],
    () => void refreshThrottled()
  )

  return { activeNodeIds }
}
