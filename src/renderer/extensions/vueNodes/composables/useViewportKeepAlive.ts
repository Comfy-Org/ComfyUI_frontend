import { tryOnScopeDispose, useThrottleFn } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'
import { boundsIntersect } from '@/renderer/core/layout/utils/layoutMath'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

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
  nodes: ComputedRef<VueNodeData[]>
  pinnedNodeIds: ComputedRef<ReadonlySet<NodeId>>
  getNodeBounds: (nodeId: NodeId) => Bounds | null
  getViewportSize: () => Size
  onNodeGeometryChange: (callback: () => void) => () => void
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
  getNodeBounds,
  getViewportSize,
  onNodeGeometryChange
}: UseViewportKeepAliveOptions) {
  const { camera } = useTransformState()
  const activeNodeIds = shallowRef<Set<NodeId>>(new Set())
  const membership = computed(() =>
    JSON.stringify(nodes.value.map((node) => node.id))
  )
  let keepAliveActive = false

  function refresh(): void {
    const nodeIds = nodes.value.map((node) => node.id)
    keepAliveActive = keepAliveActive
      ? nodeIds.length >= MIN_NODES_FOR_KEEP_ALIVE * KEEP_ALIVE_EXIT_RATIO
      : nodeIds.length >= MIN_NODES_FOR_KEEP_ALIVE

    if (!keepAliveActive) {
      const next = new Set(nodeIds)
      if (!setsEqual(next, activeNodeIds.value)) activeNodeIds.value = next
      return
    }

    const viewport = getViewportSize()
    if (viewport.width <= 0 || viewport.height <= 0) return

    const viewportBounds = getKeepAliveBounds(camera, viewport)
    const next = new Set<NodeId>()
    for (const nodeId of nodeIds) {
      const bounds = getNodeBounds(nodeId)
      if (
        !bounds ||
        !isUsableBounds(bounds) ||
        boundsIntersect(bounds, viewportBounds)
      ) {
        next.add(nodeId)
      }
    }

    for (const nodeId of pinnedNodeIds.value) {
      if (activeNodeIds.value.has(nodeId)) next.add(nodeId)
    }

    if (!setsEqual(next, activeNodeIds.value)) activeNodeIds.value = next
  }

  const refreshThrottled = useThrottleFn(refresh, REFRESH_THROTTLE_MS, true)

  watch(membership, refresh, { immediate: true })
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

  const stopGeometryListener = onNodeGeometryChange(() => {
    void refreshThrottled()
  })
  tryOnScopeDispose(stopGeometryListener)

  return { activeNodeIds }
}
