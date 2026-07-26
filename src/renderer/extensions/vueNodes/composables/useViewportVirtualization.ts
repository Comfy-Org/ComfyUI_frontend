import { useEventListener, useRafFn } from '@vueuse/core'
import { computed, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { isNodeOptionsOpen } from '@/composables/graph/useMoreOptionsMenu'
import type {
  GraphNodeManager,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  useCanvasStore,
  useTitleEditorStore
} from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import {
  clearViewportVirtualizedNodeIds,
  replaceViewportVirtualizedNodeIds
} from './viewportVirtualizationState'

const VIEWPORT_SETTLE_DELAY = 150

function normalizeNodeId(nodeId: number | NodeId): NodeId {
  return typeof nodeId === 'number' ? toNodeId(nodeId) : nodeId
}

function areNodeIdSetsEqual(
  a: ReadonlySet<NodeId>,
  b: ReadonlySet<NodeId>
): boolean {
  if (a.size !== b.size) return false
  for (const nodeId of a) {
    if (!b.has(nodeId)) return false
  }
  return true
}

interface ViewportVirtualizationOptions {
  allNodes: MaybeRefOrGetter<readonly VueNodeData[]>
  canvas: MaybeRefOrGetter<LGraphCanvas | null | undefined>
  enabled: MaybeRefOrGetter<boolean>
  nodeManager: MaybeRefOrGetter<GraphNodeManager | null | undefined>
}

export function rectsOverlap(a: ReadOnlyRect, b: ReadOnlyRect): boolean {
  return !(
    a[0] + a[2] < b[0] ||
    b[0] + b[2] < a[0] ||
    a[1] + a[3] < b[1] ||
    b[1] + b[3] < a[1]
  )
}

export function getNodesInViewport(
  nodes: readonly VueNodeData[],
  visibleArea: ReadOnlyRect,
  getNode: (id: NodeId) => LGraphNode | undefined
): Set<NodeId> {
  const result = new Set<NodeId>()
  for (const nodeData of nodes) {
    const node = getNode(nodeData.id)
    if (node && rectsOverlap(visibleArea, node.renderArea)) {
      result.add(nodeData.id)
    }
  }
  return result
}

export function useViewportVirtualization({
  allNodes,
  canvas,
  enabled,
  nodeManager
}: ViewportVirtualizationOptions) {
  const canvasStore = useCanvasStore()
  const titleEditorStore = useTitleEditorStore()
  const { state: linkDragState } = useSlotLinkDragUIState()
  const hydratedNodeIds = shallowRef(new Set<NodeId>())
  const pendingHydrationNodeIds = new Set<NodeId>()
  const viewportNodeIds = shallowRef(new Set<NodeId>())
  const layoutVersion = layoutStore.getVersion()
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let refreshFrame: number | undefined
  let hydrationFrame: number | undefined
  let lastTransform: [number, number, number] | undefined

  function getFocusedNodeId(): NodeId | undefined {
    const activeElement = document.activeElement
    if (!(activeElement instanceof HTMLElement)) return
    const nodeElement = activeElement.closest<HTMLElement>('[data-node-id]')
    const rawNodeId = nodeElement?.dataset.nodeId
    if (!rawNodeId || rawNodeId.startsWith('preview-')) return
    return toNodeId(rawNodeId)
  }

  function getProtectedNodeIds(): Set<NodeId> {
    const result = new Set<NodeId>()
    const activeCanvas = toValue(canvas)

    if (
      layoutStore.isDraggingVueNodes.value ||
      layoutStore.isResizingVueNodes.value ||
      activeCanvas?.isDragging ||
      activeCanvas?.resizingGroup ||
      isNodeOptionsOpen()
    ) {
      for (const nodeId of canvasStore.selectedNodeIds) result.add(nodeId)
    }

    const titleTarget = titleEditorStore.titleEditorTarget
    if (titleTarget && 'id' in titleTarget) {
      result.add(normalizeNodeId(titleTarget.id))
    }

    const focusedNodeId = getFocusedNodeId()
    if (focusedNodeId != null) result.add(focusedNodeId)

    const capturingNode = activeCanvas?.node_capturing_input
    if (capturingNode) result.add(normalizeNodeId(capturingNode.id))

    const sourceNodeId = linkDragState.source?.nodeId
    if (sourceNodeId != null) result.add(sourceNodeId)
    const candidateNodeId = linkDragState.candidate?.layout.nodeId
    if (candidateNodeId != null) result.add(candidateNodeId)

    for (const link of activeCanvas?.linkConnector.renderLinks ?? []) {
      if (link.node.id != null) result.add(normalizeNodeId(link.node.id))
    }

    return result
  }

  const protectedNodeIds = shallowRef(getProtectedNodeIds())

  function refreshProtectedNodeIds(): void {
    const nextProtectedNodeIds = getProtectedNodeIds()
    if (areNodeIdSetsEqual(protectedNodeIds.value, nextProtectedNodeIds)) return
    protectedNodeIds.value = nextProtectedNodeIds
  }

  const renderedNodes = computed(() => {
    const nodes = toValue(allNodes)
    if (!toValue(enabled)) return nodes

    return nodes.filter(
      (node) =>
        !hydratedNodeIds.value.has(node.id) ||
        viewportNodeIds.value.has(node.id) ||
        protectedNodeIds.value.has(node.id)
    )
  })

  function replaceViewportNodes(): void {
    refreshProtectedNodeIds()
    if (!toValue(enabled)) {
      viewportNodeIds.value = new Set(toValue(allNodes).map((node) => node.id))
      return
    }
    if (window.app?.configuringGraph) {
      scheduleSettledRefresh()
      return
    }
    const activeCanvas = toValue(canvas)
    const manager = toValue(nodeManager)
    if (!activeCanvas || !manager) {
      scheduleSettledRefresh()
      return
    }
    const mountSetFrozen =
      layoutStore.isDraggingVueNodes.value ||
      layoutStore.isResizingVueNodes.value ||
      activeCanvas.isDragging ||
      activeCanvas.resizingGroup
    if (mountSetFrozen && !linkDragState.active) return

    activeCanvas.ds.computeVisibleArea(activeCanvas.viewport)
    viewportNodeIds.value = getNodesInViewport(
      toValue(allNodes),
      activeCanvas.ds.visible_area,
      manager.getNode
    )
  }

  function scheduleFrameRefresh(): void {
    if (!toValue(enabled)) return
    if (refreshFrame != null) cancelAnimationFrame(refreshFrame)
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = undefined
      replaceViewportNodes()
    })
  }

  function scheduleSettledRefresh(): void {
    if (!toValue(enabled)) return
    if (settleTimer != null) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      settleTimer = undefined
      replaceViewportNodes()
    }, VIEWPORT_SETTLE_DELAY)
  }

  function cancelScheduledRefreshes(): void {
    if (settleTimer != null) {
      clearTimeout(settleTimer)
      settleTimer = undefined
    }
    if (refreshFrame != null) {
      cancelAnimationFrame(refreshFrame)
      refreshFrame = undefined
    }
    if (hydrationFrame != null) {
      cancelAnimationFrame(hydrationFrame)
      hydrationFrame = undefined
    }
  }

  function schedulePostHydrationRefresh(): void {
    if (!toValue(enabled)) return
    if (hydrationFrame != null) cancelAnimationFrame(hydrationFrame)
    hydrationFrame = requestAnimationFrame(() => {
      hydrationFrame = requestAnimationFrame(() => {
        hydrationFrame = undefined
        if (pendingHydrationNodeIds.size > 0) {
          hydratedNodeIds.value = new Set([
            ...hydratedNodeIds.value,
            ...pendingHydrationNodeIds
          ])
        }
        pendingHydrationNodeIds.clear()
        replaceViewportNodes()
      })
    })
  }

  function onNodeMounted(nodeId: NodeId): void {
    if (
      hydratedNodeIds.value.has(nodeId) ||
      pendingHydrationNodeIds.has(nodeId)
    )
      return
    pendingHydrationNodeIds.add(nodeId)
    schedulePostHydrationRefresh()
  }

  const transformWatcher = useRafFn(
    () => {
      refreshProtectedNodeIds()
      const ds = toValue(canvas)?.ds
      if (!ds) return
      const transform: [number, number, number] = [
        ds.scale,
        ds.offset[0],
        ds.offset[1]
      ]
      if (
        lastTransform &&
        transform[0] === lastTransform[0] &&
        transform[1] === lastTransform[1] &&
        transform[2] === lastTransform[2]
      ) {
        return
      }
      lastTransform = transform
      scheduleSettledRefresh()
    },
    { immediate: false }
  )

  watch(
    () => toValue(canvas)?.graph,
    () => {
      hydratedNodeIds.value = new Set()
      pendingHydrationNodeIds.clear()
      viewportNodeIds.value = new Set()
      clearViewportVirtualizedNodeIds()
      lastTransform = undefined
    },
    { flush: 'sync' }
  )

  watch(
    () => JSON.stringify(toValue(allNodes).map((node) => node.id)),
    () => {
      const nodeIds = toValue(allNodes).map((node) => node.id)
      const currentNodeIds = new Set(nodeIds)
      const nextHydratedNodeIds = new Set(
        Array.from(hydratedNodeIds.value).filter((nodeId) =>
          currentNodeIds.has(nodeId)
        )
      )
      if (!areNodeIdSetsEqual(hydratedNodeIds.value, nextHydratedNodeIds)) {
        hydratedNodeIds.value = nextHydratedNodeIds
      }
      for (const nodeId of pendingHydrationNodeIds) {
        if (!currentNodeIds.has(nodeId)) pendingHydrationNodeIds.delete(nodeId)
      }
      const nextViewportNodeIds = new Set(
        Array.from(viewportNodeIds.value).filter((id) => currentNodeIds.has(id))
      )
      if (!areNodeIdSetsEqual(viewportNodeIds.value, nextViewportNodeIds)) {
        viewportNodeIds.value = nextViewportNodeIds
      }
      if (
        nodeIds.every(
          (nodeId) =>
            hydratedNodeIds.value.has(nodeId) ||
            pendingHydrationNodeIds.has(nodeId)
        )
      ) {
        schedulePostHydrationRefresh()
      }
    },
    { flush: 'post' }
  )

  watch(
    renderedNodes,
    (nodes) => {
      const renderedNodeIds = new Set(nodes.map((node) => node.id))
      replaceViewportVirtualizedNodeIds(
        toValue(allNodes)
          .map((node) => node.id)
          .filter((nodeId) => !renderedNodeIds.has(nodeId))
      )
    },
    { immediate: true, flush: 'sync' }
  )

  watch(
    () => toValue(enabled),
    (isEnabled) => {
      if (!isEnabled) {
        transformWatcher.pause()
        cancelScheduledRefreshes()
        clearViewportVirtualizedNodeIds()
        viewportNodeIds.value = new Set(
          toValue(allNodes).map((node) => node.id)
        )
        return
      }
      transformWatcher.resume()
      schedulePostHydrationRefresh()
    },
    { immediate: true, flush: 'sync' }
  )

  watch(layoutVersion, scheduleSettledRefresh)
  watch(
    [layoutStore.isDraggingVueNodes, layoutStore.isResizingVueNodes],
    ([dragging, resizing]) => {
      if (!dragging && !resizing) scheduleFrameRefresh()
    }
  )
  watch(
    () => linkDragState.active,
    (active) => {
      if (!active) scheduleFrameRefresh()
    }
  )

  useEventListener(window, ['pointerup', 'pointercancel'], scheduleFrameRefresh)
  useEventListener(window, ['focusin', 'pointerdown'], refreshProtectedNodeIds)

  onScopeDispose(() => {
    cancelScheduledRefreshes()
    clearViewportVirtualizedNodeIds()
  })

  return { onNodeMounted, renderedNodes }
}
