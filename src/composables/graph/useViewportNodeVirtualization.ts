import { useEventListener, useRafFn } from '@vueuse/core'
import { shallowReadonly, shallowRef, toValue, triggerRef, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { isNodeOptionsOpen } from '@/composables/graph/useMoreOptionsMenu'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  useCanvasStore,
  useTitleEditorStore
} from '@/renderer/core/canvas/canvasStore'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Bounds } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'
import { isLGraphNode } from '@/utils/litegraphUtil'

const VIEWPORT_OVERSCAN_RATIO = 0.25

export function getViewportBounds(
  canvas: LGraphCanvas,
  overscanRatio = VIEWPORT_OVERSCAN_RATIO
): Bounds | null {
  const { ds, viewport } = canvas
  const scale = ds.scale
  if (!(scale > 0) || !ds.element) return null

  let width = ds.element.width
  let height = ds.element.height
  let x = -ds.offset[0]
  let y = -ds.offset[1]

  if (viewport) {
    x += viewport[0] / scale
    y += viewport[1] / scale
    width = viewport[2]
    height = viewport[3]
  }

  const graphWidth = width / scale
  const graphHeight = height / scale
  const overscanX = graphWidth * overscanRatio
  const overscanY = graphHeight * overscanRatio

  return {
    x: x - overscanX,
    y: y - overscanY,
    width: graphWidth + overscanX * 2,
    height: graphHeight + overscanY * 2
  }
}

function haveSameNodeIds(
  left: readonly VueNodeData[],
  right: readonly VueNodeData[]
): boolean {
  return (
    left.length === right.length &&
    left.every((node, index) => node.id === right[index]?.id)
  )
}

export function createRenderNodeList(options: {
  allNodes: readonly VueNodeData[]
  enabled: boolean
  layoutReady: boolean
  visibleNodeIds: ReadonlySet<NodeId>
  pinnedNodeIds: ReadonlySet<NodeId>
  previous: VueNodeData[]
}): VueNodeData[] {
  const {
    allNodes,
    enabled,
    layoutReady,
    visibleNodeIds,
    pinnedNodeIds,
    previous
  } = options
  const next =
    enabled && layoutReady
      ? allNodes.filter(
          (node) => visibleNodeIds.has(node.id) || pinnedNodeIds.has(node.id)
        )
      : [...allNodes]

  if (!haveSameNodeIds(previous, next)) return next

  // Preserve the array identity while refreshing the per-node data objects.
  // GraphNodeManager replaces these objects when reactive node state changes.
  for (let index = 0; index < next.length; index++) {
    previous[index] = next[index]
  }
  return previous
}

export function createPinnedNodeIds(options: {
  activePointerNodeIds?: Iterable<NodeId>
  selectedNodeIds?: Iterable<NodeId>
  focusedNodeId?: NodeId
  titleEditedNodeId?: NodeId
  contextMenuTargetNodeIds?: Iterable<NodeId>
  capturingInputNodeId?: NodeId
  linkEndpointNodeIds?: Iterable<NodeId>
}): Set<NodeId> {
  const result = new Set(options.activePointerNodeIds)
  for (const nodeId of options.selectedNodeIds ?? []) result.add(nodeId)
  for (const nodeId of options.contextMenuTargetNodeIds ?? []) {
    result.add(nodeId)
  }
  for (const nodeId of options.linkEndpointNodeIds ?? []) result.add(nodeId)
  if (options.focusedNodeId) result.add(options.focusedNodeId)
  if (options.titleEditedNodeId) result.add(options.titleEditedNodeId)
  if (options.capturingInputNodeId) result.add(options.capturingInputNodeId)
  return result
}

function getNodeIdFromElement(target: EventTarget | null): NodeId | undefined {
  if (!(target instanceof Element)) return
  const value = target.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
  return value ? toNodeId(value) : undefined
}

function boundsKey(bounds: Bounds | null): string {
  if (!bounds) return 'none'
  return `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`
}

export function useViewportNodeVirtualization(options: {
  allNodes: MaybeRefOrGetter<readonly VueNodeData[]>
  canvas: MaybeRefOrGetter<LGraphCanvas | null | undefined>
  enabled: MaybeRefOrGetter<boolean>
}) {
  const canvasStore = useCanvasStore()
  const titleEditorStore = useTitleEditorStore()
  const { state: slotDragState } = useSlotLinkDragUIState()
  const renderNodes = shallowRef<VueNodeData[]>([])
  const activePointerNodes = new Map<number, NodeId>()
  const focusedNodeId = shallowRef<NodeId>()

  let lastNodes: readonly VueNodeData[] | undefined
  let lastCanvas: LGraphCanvas | null | undefined
  let lastViewportKey = ''
  let lastLayoutRevision = -1
  let lastPinnedStateKey = ''
  let lastEnabled: boolean | undefined
  let pinnedStateRevision = 0
  let cachedPinnedCanvas: LGraphCanvas | undefined
  let cachedPinnedStateKey = ''
  let cachedPinnedNodeIds = new Set<NodeId>()
  let cachedLayoutRevision = -1
  let cachedLayoutNodeIds: NodeId[] = []
  let cachedLayoutReady = false

  function collectPinnedNodeIds(canvas: LGraphCanvas): Set<NodeId> {
    const titleTarget = titleEditorStore.titleEditorTarget
    const titleEditedNodeId =
      titleTarget && isLGraphNode(titleTarget) ? titleTarget.id : undefined

    const selectedNodeIds: NodeId[] = []
    const contextMenuTargetNodeIds: NodeId[] = []
    if (
      layoutStore.isDraggingVueNodes.value ||
      layoutStore.isResizingVueNodes.value
    ) {
      for (const item of canvasStore.selectedItems) {
        if (isLGraphNode(item)) selectedNodeIds.push(item.id)
      }
    }

    if (isNodeOptionsOpen()) {
      for (const item of canvasStore.selectedItems) {
        if (isLGraphNode(item)) contextMenuTargetNodeIds.push(item.id)
      }
    }

    const linkEndpointNodeIds: NodeId[] = []
    if (slotDragState.active) {
      if (slotDragState.source) {
        linkEndpointNodeIds.push(slotDragState.source.nodeId)
      }
      if (slotDragState.candidate) {
        linkEndpointNodeIds.push(slotDragState.candidate.layout.nodeId)
      }
    }

    for (const link of canvas.linkConnector.renderLinks) {
      if (isLGraphNode(link.node)) linkEndpointNodeIds.push(link.node.id)
    }

    return createPinnedNodeIds({
      activePointerNodeIds: activePointerNodes.values(),
      selectedNodeIds,
      focusedNodeId: focusedNodeId.value,
      titleEditedNodeId,
      contextMenuTargetNodeIds,
      capturingInputNodeId: canvas.node_capturing_input?.id ?? undefined,
      linkEndpointNodeIds
    })
  }

  function getPinnedStateKey(canvas: LGraphCanvas): string {
    const renderLinkNodeIds = canvas.linkConnector.renderLinks
      .map((link) => (isLGraphNode(link.node) ? link.node.id : ''))
      .join(',')
    return `${pinnedStateRevision}|${isNodeOptionsOpen()}|${canvas.node_capturing_input?.id ?? ''}|${renderLinkNodeIds}`
  }

  function getPinnedNodeIds(canvas: LGraphCanvas) {
    const stateKey = getPinnedStateKey(canvas)
    if (cachedPinnedCanvas !== canvas || cachedPinnedStateKey !== stateKey) {
      cachedPinnedCanvas = canvas
      cachedPinnedStateKey = stateKey
      cachedPinnedNodeIds = collectPinnedNodeIds(canvas)
    }
    return { nodeIds: cachedPinnedNodeIds, stateKey }
  }

  function getLayoutReady(
    allNodes: readonly VueNodeData[],
    layoutRevision: number
  ): boolean {
    const nodeIdsChanged =
      cachedLayoutNodeIds.length !== allNodes.length ||
      allNodes.some((node, index) => node.id !== cachedLayoutNodeIds[index])
    if (cachedLayoutRevision !== layoutRevision || nodeIdsChanged) {
      cachedLayoutRevision = layoutRevision
      cachedLayoutNodeIds = allNodes.map((node) => node.id)
      cachedLayoutReady = allNodes.every((node) =>
        layoutStore.hasNodeLayout(node.id)
      )
    }
    return cachedLayoutReady
  }

  function refresh(force = false) {
    const allNodes = toValue(options.allNodes)
    const enabled = toValue(options.enabled)

    if (!enabled) {
      if (!force && lastNodes === allNodes && lastEnabled === enabled) return

      lastNodes = allNodes
      lastEnabled = enabled

      const previous = renderNodes.value
      const next = createRenderNodeList({
        allNodes,
        enabled,
        layoutReady: false,
        visibleNodeIds: new Set<NodeId>(),
        pinnedNodeIds: new Set<NodeId>(),
        previous
      })
      if (next === previous) triggerRef(renderNodes)
      else renderNodes.value = next
      return
    }

    const canvas = toValue(options.canvas)
    const viewportBounds = canvas ? getViewportBounds(canvas) : null
    const viewportKey = boundsKey(viewportBounds)
    const layoutRevision = layoutStore.getRevision()
    const pinnedState = canvas ? getPinnedNodeIds(canvas) : undefined
    const pinnedNodeIds = pinnedState?.nodeIds ?? new Set<NodeId>()
    const pinnedStateKey = pinnedState?.stateKey ?? 'none'

    if (
      !force &&
      lastNodes === allNodes &&
      lastCanvas === canvas &&
      lastViewportKey === viewportKey &&
      lastLayoutRevision === layoutRevision &&
      lastPinnedStateKey === pinnedStateKey &&
      lastEnabled === enabled
    ) {
      return
    }

    lastNodes = allNodes
    lastCanvas = canvas
    lastViewportKey = viewportKey
    lastLayoutRevision = layoutRevision
    lastPinnedStateKey = pinnedStateKey
    lastEnabled = enabled

    const layoutReady =
      Boolean(viewportBounds) && getLayoutReady(allNodes, layoutRevision)
    const visibleNodeIds =
      enabled && layoutReady && viewportBounds
        ? new Set(layoutStore.queryNodesInBounds(viewportBounds))
        : new Set<NodeId>()

    const previous = renderNodes.value
    const next = createRenderNodeList({
      allNodes,
      enabled,
      layoutReady,
      visibleNodeIds,
      pinnedNodeIds,
      previous
    })
    if (next === previous) triggerRef(renderNodes)
    else renderNodes.value = next
  }

  useEventListener(
    document,
    'pointerdown',
    (event) => {
      const nodeId = getNodeIdFromElement(event.target)
      if (nodeId && activePointerNodes.get(event.pointerId) !== nodeId) {
        activePointerNodes.set(event.pointerId, nodeId)
        pinnedStateRevision++
      }
    },
    { capture: true }
  )
  useEventListener(document, ['pointerup', 'pointercancel'], (event) => {
    if (activePointerNodes.delete(event.pointerId)) pinnedStateRevision++
  })
  useEventListener(document, ['focusin', 'focusout'], () => {
    queueMicrotask(() => {
      focusedNodeId.value = getNodeIdFromElement(document.activeElement)
    })
  })

  watch(
    [
      () => [...canvasStore.selectedNodeIds].join(','),
      () => layoutStore.isDraggingVueNodes.value,
      () => layoutStore.isResizingVueNodes.value,
      () => focusedNodeId.value,
      () => {
        const target = titleEditorStore.titleEditorTarget
        return target && isLGraphNode(target) ? target.id : undefined
      },
      () => slotDragState.active,
      () => slotDragState.source?.nodeId,
      () => slotDragState.candidate?.layout.nodeId
    ],
    () => {
      pinnedStateRevision++
    },
    { flush: 'sync' }
  )

  const { pause, resume } = useRafFn(() => refresh(), { immediate: true })
  watch(
    () => toValue(options.enabled),
    (enabled) => {
      if (enabled) resume()
      else pause()
      refresh(true)
    },
    { flush: 'sync', immediate: true }
  )

  return {
    renderNodes: shallowReadonly(renderNodes),
    refresh
  }
}
