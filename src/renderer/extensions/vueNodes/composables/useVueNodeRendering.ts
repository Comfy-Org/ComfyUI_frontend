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
  enabled?: MaybeRefOrGetter<boolean>
  nodeManager: MaybeRefOrGetter<GraphNodeManager | null | undefined>
}

interface FrameState {
  scale: number | undefined
  offsetX: number | undefined
  offsetY: number | undefined
  canvasWidth: number | undefined
  canvasHeight: number | undefined
  draggingCanvas: boolean | undefined
  tail: readonly unknown[]
}

type FrameStateChange = 'runtime' | 'viewport' | false

let activeInstance: object | undefined

function nodeId(
  node: { id: string | number } | null | undefined
): string | undefined {
  return node ? String(node.id) : undefined
}

function areSameNodes(
  a: readonly VueNodeData[],
  b: readonly VueNodeData[]
): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
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
  enabled = true,
  nodeManager
}: VueNodeRenderingOptions) {
  const instance = {}
  activeInstance = instance
  const canvasStore = useCanvasStore()
  const titleEditorStore = useTitleEditorStore()
  const { state: linkDragState } = useSlotLinkDragUIState()
  const layoutVersion = layoutStore.getVersion()
  const snapshot = shallowRef<VueNodeRenderingSnapshot>(
    vueNodeRenderingService.getSnapshot()
  )
  const renderedNodeIds = shallowRef(snapshot.value.renderedNodeIds)

  const unsubscribe = vueNodeRenderingService.subscribe((nextSnapshot) => {
    snapshot.value = nextSnapshot
    renderedNodeIds.value = nextSnapshot.renderedNodeIds
  })
  let lastFrameState: FrameState | undefined

  function getFrontendRequiredNodeIds(
    activeCanvas: LGraphCanvas | null | undefined,
    focusedId: string | undefined
  ): string[] {
    const result = new Set<string>()
    const add = (id: string | undefined) => {
      if (id) result.add(id)
    }

    add(focusedId)
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
    if (!toValue(enabled)) return
    const activeCanvas = toValue(canvas)
    const manager = toValue(nodeManager)
    const nodes = toValue(allNodes)
    const focusedId = focusedNodeId()
    const renderFrozen = Boolean(
      layoutStore.isDraggingVueNodes.value ||
      layoutStore.isResizingVueNodes.value ||
      activeCanvas?.isDragging ||
      activeCanvas?.dragging_canvas ||
      activeCanvas?.resizingGroup
    )

    vueNodeRenderingService.updateRuntime({
      graph: activeCanvas?.graph ?? null,
      managerAvailable: Boolean(manager),
      nodes: renderFrozen
        ? snapshot.value.renderAreas.map(({ id, area }) => ({
            id,
            renderArea: area
          }))
        : manager
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
      frontendRequiredNodeIds: getFrontendRequiredNodeIds(
        activeCanvas,
        focusedId
      ),
      renderFrozen
    })
    lastFrameState = getFrameState(activeCanvas, focusedId)
  }

  function refreshViewport(
    activeCanvas: LGraphCanvas | null | undefined
  ): void {
    vueNodeRenderingService.updateViewport(visibleArea(activeCanvas))
    const previousState = lastFrameState
    if (!previousState) {
      lastFrameState = getFrameState(activeCanvas, focusedNodeId())
      return
    }
    lastFrameState = {
      ...previousState,
      scale: activeCanvas?.ds.scale,
      offsetX: activeCanvas?.ds.offset[0],
      offsetY: activeCanvas?.ds.offset[1],
      canvasWidth: activeCanvas?.canvas.width,
      canvasHeight: activeCanvas?.canvas.height
    }
  }

  function getFrameState(
    activeCanvas: LGraphCanvas | null | undefined,
    focusedId: string | undefined
  ): FrameState {
    return {
      scale: activeCanvas?.ds.scale,
      offsetX: activeCanvas?.ds.offset[0],
      offsetY: activeCanvas?.ds.offset[1],
      canvasWidth: activeCanvas?.canvas.width,
      canvasHeight: activeCanvas?.canvas.height,
      draggingCanvas: activeCanvas?.dragging_canvas,
      tail: [
        activeCanvas?.isDragging,
        Boolean(activeCanvas?.resizingGroup),
        nodeId(activeCanvas?.node_capturing_input),
        nodeId(activeCanvas?.node_widget?.[0]),
        nodeId(activeCanvas?.resizing_node),
        focusedId,
        isNodeOptionsOpen(),
        ...Array.from(activeCanvas?.linkConnector.renderLinks ?? [], (link) =>
          nodeId(link.node)
        )
      ]
    }
  }

  function getFrameStateChange(
    activeCanvas: LGraphCanvas | null | undefined
  ): FrameStateChange {
    const previousState = lastFrameState
    if (
      !previousState ||
      activeCanvas?.dragging_canvas !== previousState.draggingCanvas
    ) {
      return 'runtime'
    }
    if (
      activeCanvas?.ds.scale !== previousState.scale ||
      activeCanvas?.ds.offset[0] !== previousState.offsetX ||
      activeCanvas?.ds.offset[1] !== previousState.offsetY ||
      activeCanvas?.canvas.width !== previousState.canvasWidth ||
      activeCanvas?.canvas.height !== previousState.canvasHeight
    ) {
      return 'viewport'
    }

    const nextState = getFrameState(activeCanvas, focusedNodeId())
    return nextState.tail.length !== previousState.tail.length ||
      nextState.tail.some((value, index) => value !== previousState.tail[index])
      ? 'runtime'
      : false
  }

  function shouldTrackRuntime(
    activeCanvas: LGraphCanvas | null | undefined
  ): boolean {
    return Boolean(
      activeCanvas?.dirty_canvas ||
      activeCanvas?.dirty_bgcanvas ||
      activeCanvas?.dragging_canvas ||
      activeCanvas?.dragging_canvas !== lastFrameState?.draggingCanvas ||
      layoutStore.isDraggingVueNodes.value ||
      layoutStore.isResizingVueNodes.value ||
      activeCanvas?.isDragging ||
      activeCanvas?.resizingGroup ||
      activeCanvas?.node_capturing_input ||
      activeCanvas?.node_widget ||
      activeCanvas?.resizing_node ||
      linkDragState.active ||
      activeCanvas?.linkConnector.renderLinks.length ||
      isNodeOptionsOpen()
    )
  }

  const renderedNodes = computed<VueNodeData[]>((previous) => {
    const renderedIds = new Set(renderedNodeIds.value)
    const next = toValue(allNodes).filter((node) =>
      renderedIds.has(String(node.id))
    )
    return previous && areSameNodes(previous, next) ? previous : next
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
      () =>
        toValue(allNodes)
          .map((node) => node.id)
          .join('\0'),
      () => toValue(enabled),
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
    if (!toValue(enabled)) return
    const activeCanvas = toValue(canvas)
    if (!shouldTrackRuntime(activeCanvas)) return
    const stateChange = getFrameStateChange(activeCanvas)
    if (stateChange === 'runtime') refreshRuntime()
    else if (stateChange === 'viewport') refreshViewport(activeCanvas)
  })

  onScopeDispose(() => {
    if (activeInstance !== instance) return
    activeInstance = undefined
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
