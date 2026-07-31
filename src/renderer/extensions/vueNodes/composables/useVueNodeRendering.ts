import { useRafFn } from '@vueuse/core'
import { computed, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { isNodeOptionsOpen } from '@/composables/graph/useMoreOptionsMenu'
import type {
  GraphNodeManager,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  useCanvasStore,
  useTitleEditorStore
} from '@/renderer/core/canvas/canvasStore'
import { useSlotLinkDragUIState } from '@/renderer/core/canvas/links/slotLinkDragUIState'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { vueNodeRenderingService } from '@/renderer/extensions/vueNodes/services/vueNodeRenderingService'
import type {
  VueNodeRenderArea,
  VueNodeRenderingSnapshot
} from '@/types/vueNodeRendering'

interface VueNodeRenderingOptions {
  allNodes: MaybeRefOrGetter<readonly VueNodeData[]>
  canvas: MaybeRefOrGetter<LGraphCanvas | null | undefined>
  nodeManager: MaybeRefOrGetter<GraphNodeManager | null | undefined>
}

function nodeId(
  node: { id: string | number } | null | undefined
): string | undefined {
  return node ? String(node.id) : undefined
}

function focusedNodeId(): string | undefined {
  const activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement)) return
  const nodeElement = activeElement.closest<HTMLElement>('[data-node-id]')
  const id = nodeElement?.dataset.nodeId
  return id && !id.startsWith('preview-') ? id : undefined
}

function visibleArea(canvas: LGraphCanvas | null | undefined) {
  if (!canvas) return null
  canvas.ds.computeVisibleArea(canvas.viewport)
  const area = canvas.ds.visible_area
  return [area[0], area[1], area[2], area[3]] as VueNodeRenderArea
}

export function useVueNodeRendering({
  allNodes,
  canvas,
  nodeManager
}: VueNodeRenderingOptions) {
  const canvasStore = useCanvasStore()
  const titleEditorStore = useTitleEditorStore()
  const { state: linkDragState } = useSlotLinkDragUIState()
  const layoutVersion = layoutStore.getVersion()
  const snapshot = shallowRef<VueNodeRenderingSnapshot>(
    vueNodeRenderingService.getSnapshot()
  )

  const unsubscribe = vueNodeRenderingService.subscribe((nextSnapshot) => {
    snapshot.value = nextSnapshot
  })
  let lastFrameState: readonly unknown[] = []

  function getFrontendRequiredNodeIds(
    activeCanvas: LGraphCanvas | null | undefined
  ): string[] {
    const result = new Set<string>()
    const add = (id: string | undefined) => {
      if (id) result.add(id)
    }

    add(focusedNodeId())
    const titleTarget = titleEditorStore.titleEditorTarget
    if (titleTarget && 'id' in titleTarget) add(String(titleTarget.id))
    add(nodeId(activeCanvas?.node_capturing_input))
    add(nodeId(activeCanvas?.node_widget?.[0]))
    add(nodeId(activeCanvas?.resizing_node))

    const interacting =
      layoutStore.isDraggingVueNodes.value ||
      layoutStore.isResizingVueNodes.value ||
      activeCanvas?.isDragging ||
      Boolean(activeCanvas?.resizingGroup) ||
      isNodeOptionsOpen()
    if (interacting) {
      for (const id of canvasStore.selectedNodeIds) add(String(id))
    }

    if (linkDragState.active) {
      add(linkDragState.source?.nodeId)
      add(linkDragState.candidate?.layout.nodeId)
    }
    for (const link of activeCanvas?.linkConnector.renderLinks ?? []) {
      add(nodeId(link.node))
    }

    return Array.from(result)
  }

  function refreshRuntime(): void {
    const activeCanvas = toValue(canvas)
    const manager = toValue(nodeManager)
    const nodes = toValue(allNodes)

    vueNodeRenderingService.updateRuntime({
      graph: activeCanvas?.graph ?? null,
      managerAvailable: Boolean(manager),
      nodes: manager
        ? nodes.map((node) => {
            const area = manager.getNode(node.id)?.renderArea
            return {
              id: String(node.id),
              renderArea: area
                ? [area[0], area[1], area[2], area[3]]
                : [0, 0, 0, 0]
            }
          })
        : [],
      visibleCanvasArea: visibleArea(activeCanvas),
      frontendRequiredNodeIds: getFrontendRequiredNodeIds(activeCanvas),
      renderFrozen: Boolean(
        layoutStore.isDraggingVueNodes.value ||
        layoutStore.isResizingVueNodes.value ||
        activeCanvas?.isDragging ||
        activeCanvas?.resizingGroup
      )
    })
    lastFrameState = getFrameState(activeCanvas)
  }

  function getFrameState(
    activeCanvas: LGraphCanvas | null | undefined
  ): readonly unknown[] {
    return [
      activeCanvas?.ds.scale,
      activeCanvas?.ds.offset[0],
      activeCanvas?.ds.offset[1],
      activeCanvas?.canvas.width,
      activeCanvas?.canvas.height,
      activeCanvas?.isDragging,
      Boolean(activeCanvas?.resizingGroup),
      nodeId(activeCanvas?.node_capturing_input),
      nodeId(activeCanvas?.node_widget?.[0]),
      nodeId(activeCanvas?.resizing_node),
      focusedNodeId(),
      isNodeOptionsOpen(),
      ...Array.from(activeCanvas?.linkConnector.renderLinks ?? [], (link) =>
        nodeId(link.node)
      )
    ]
  }

  function frameStateChanged(): boolean {
    const nextState = getFrameState(toValue(canvas))
    return (
      nextState.length !== lastFrameState.length ||
      nextState.some((value, index) => value !== lastFrameState[index])
    )
  }

  const renderedNodes = computed(() => {
    const renderedIds = new Set(snapshot.value.renderedNodeIds)
    return toValue(allNodes).filter((node) => renderedIds.has(String(node.id)))
  })

  function onNodeMounted(id: VueNodeData['id']): void {
    vueNodeRenderingService.nodeMounted(String(id))
  }

  function onNodeUnmounted(id: VueNodeData['id']): void {
    vueNodeRenderingService.nodeUnmounted(String(id))
  }

  watch(
    [
      () => toValue(canvas)?.graph,
      () => toValue(nodeManager),
      () => toValue(allNodes).map((node) => node.id),
      layoutStore.isDraggingVueNodes,
      layoutStore.isResizingVueNodes,
      () => canvasStore.selectedNodeIds,
      () => titleEditorStore.titleEditorTarget,
      () => linkDragState.active,
      () => linkDragState.source?.nodeId,
      () => linkDragState.candidate?.layout.nodeId,
      layoutVersion
    ],
    refreshRuntime,
    { immediate: true, flush: 'sync' }
  )

  const runtimeTracker = useRafFn(() => {
    if (frameStateChanged()) refreshRuntime()
  })

  onScopeDispose(() => {
    runtimeTracker.pause()
    unsubscribe()
    vueNodeRenderingService.updateRuntime({
      graph: null,
      managerAvailable: false,
      nodes: [],
      visibleCanvasArea: null,
      frontendRequiredNodeIds: [],
      renderFrozen: false
    })
  })

  return { onNodeMounted, onNodeUnmounted, renderedNodes }
}
