import {
  tryOnScopeDispose,
  useDebounceFn,
  useEventListener,
  useThrottleFn
} from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'

import { createMountAdmissionScheduler } from './mountAdmissionScheduler'
import { createMountDepartureScheduler } from './mountDepartureScheduler'
import {
  decideViewportVisibility,
  getCullingBounds,
  getNextCullingLatch
} from './viewportVisibility'

export { getCullingBounds } from './viewportVisibility'

const UNMOUNT_DELAY_MS = 250
const RECOMPUTE_THROTTLE_MS = 100
const ZOOM_SETTLE_MS = 160
const PRUNE_SLACK = 8
const MOUNT_FRAME_BUDGET_MS = 20
const MIN_NODES_FOR_CULLING = 150

interface Size {
  width: number
  height: number
}

interface UseViewportCullingOptions {
  nodes: ComputedRef<VueNodeData[]>
  queryNodesInBounds: (bounds: Bounds) => Iterable<NodeId>
  getViewportSize: () => Size
  getPinnedIds?: () => ReadonlySet<NodeId> | undefined
  getAlwaysMountedIds?: () => ReadonlySet<NodeId> | undefined
  membership?: ComputedRef<string>
  mountFrameBudgetMs?: number
  isEnabled?: () => boolean
  minNodesForCulling?: number
  onNodeGeometryChange?: (callback: () => void) => () => void
}

export function useViewportCulling({
  nodes,
  queryNodesInBounds,
  getViewportSize,
  getPinnedIds,
  getAlwaysMountedIds,
  membership,
  isEnabled,
  minNodesForCulling = MIN_NODES_FOR_CULLING,
  mountFrameBudgetMs = MOUNT_FRAME_BUDGET_MS,
  onNodeGeometryChange
}: UseViewportCullingOptions) {
  const { camera } = useTransformState()
  const mountedNodeIds = shallowRef<Set<NodeId>>(new Set())
  const admission = createMountAdmissionScheduler(
    mountedNodeIds,
    mountFrameBudgetMs
  )
  const departure = createMountDepartureScheduler(
    mountedNodeIds,
    UNMOUNT_DELAY_MS
  )

  let disposed = false
  let cullingLatched = false

  function computeDesiredNodeIds(): Set<NodeId> {
    const nodeIds = nodes.value.map((node) => node.id)
    const viewport = getViewportSize()
    const viewportResolved = viewport.width > 0 && viewport.height > 0
    const cullingEnabled = isEnabled?.() !== false
    const nextLatched = getNextCullingLatch(
      nodeIds.length,
      cullingEnabled,
      cullingLatched,
      minNodesForCulling
    )
    const viewportNodeIds =
      nextLatched && viewportResolved
        ? queryNodesInBounds(getCullingBounds(camera, viewport))
        : []
    const decision = decideViewportVisibility({
      nodeIds,
      mountedNodeIds: mountedNodeIds.value,
      viewportNodeIds,
      pinnedNodeIds: getPinnedIds?.(),
      alwaysMountedNodeIds: getAlwaysMountedIds?.(),
      cullingEnabled,
      cullingLatched,
      minNodesForCulling,
      viewportResolved
    })
    cullingLatched = decision.cullingLatched
    return decision.desiredNodeIds
  }

  function refreshMountedNodes(allowMount = true, immediate = false): void {
    if (disposed) return
    const desiredNodeIds = computeDesiredNodeIds()
    const mounted = mountedNodeIds.value
    const enteringNodeIds = Array.from(desiredNodeIds).filter(
      (nodeId) => !mounted.has(nodeId)
    )
    const hasDepartedNodes = Array.from(mounted).some(
      (nodeId) => !desiredNodeIds.has(nodeId)
    )

    if (allowMount) admission.replace(enteringNodeIds, immediate)
    else admission.reset()

    if (!hasDepartedNodes) return

    if (mounted.size > desiredNodeIds.size * 2 + PRUNE_SLACK) {
      departure.prune(desiredNodeIds)
      return
    }
    departure.schedule(computeDesiredNodeIds)
  }

  const refreshThrottled = useThrottleFn(
    () => refreshMountedNodes(),
    RECOMPUTE_THROTTLE_MS,
    true
  )
  const refreshThrottledPruneOnly = useThrottleFn(
    () => refreshMountedNodes(false),
    RECOMPUTE_THROTTLE_MS,
    true
  )
  const refreshAfterZoom = useDebounceFn(
    () => refreshMountedNodes(),
    ZOOM_SETTLE_MS
  )

  const membershipKey =
    membership ??
    computed(() => JSON.stringify(nodes.value.map((node) => node.id)))
  watch(membershipKey, () => refreshMountedNodes(true, true), {
    immediate: true
  })

  if (isEnabled)
    watch(
      () => isEnabled(),
      () => refreshMountedNodes(true, true)
    )
  if (getPinnedIds)
    watch(
      () => getPinnedIds(),
      () => refreshMountedNodes()
    )
  if (getAlwaysMountedIds) {
    watch(
      () => getAlwaysMountedIds(),
      () => refreshMountedNodes()
    )
  }

  watch(
    () => {
      const viewport = getViewportSize()
      return [viewport.width, viewport.height] as const
    },
    () => refreshMountedNodes()
  )

  let lastScale = camera.z
  watch(
    () => [camera.x, camera.y, camera.z],
    () => {
      if (camera.z !== lastScale) {
        lastScale = camera.z
        void refreshThrottledPruneOnly()
        void refreshAfterZoom()
      } else {
        void refreshThrottled()
      }
    }
  )

  useEventListener(window, 'resize', () => refreshMountedNodes())
  const stopGeometryListener = onNodeGeometryChange?.(() => {
    void refreshThrottled()
  })

  tryOnScopeDispose(() => {
    disposed = true
    stopGeometryListener?.()
    admission.dispose()
    departure.dispose()
  })

  return { mountedNodeIds }
}
