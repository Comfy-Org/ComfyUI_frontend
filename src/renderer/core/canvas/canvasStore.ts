import { useEventListener, whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { useAppMode } from '@/composables/useAppMode'

import type { Point, Positionable } from '@/lib/litegraph/src/interfaces'
import type {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { resolveSelectable } from '@/renderer/core/canvas/litegraph/selectionAdapter'
import { promoteRecommendedWidgets } from '@/core/graph/subgraph/promotionUtils'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import { graphScopeOf } from '@/types/graphScopeId'
import { serializeNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { isLGraphNode } from '@/utils/litegraphUtil'

export const useTitleEditorStore = defineStore('titleEditor', () => {
  const titleEditorTarget = shallowRef<LGraphNode | LGraphGroup | null>(null)

  return {
    titleEditorTarget
  }
})

export const useCanvasStore = defineStore('canvas', () => {
  /**
   * The LGraphCanvas instance.
   *
   * The root LGraphCanvas object is a shallow ref.
   */
  const canvas = shallowRef<LGraphCanvas | null>(null)
  const selectionStore = useSelectionStore()

  // Reactive scale percentage that syncs with app.canvas.ds.scale
  const appScalePercentage = ref(100)
  const updateAppScalePercentage = (scale: number) => {
    appScalePercentage.value = Math.round(scale * 100)
  }

  const { isAppMode, setMode } = useAppMode()
  const linearMode = computed({
    get: () => isAppMode.value,
    set: (val: boolean) => {
      setMode(val ? 'app' : 'graph')
    }
  })
  const isReadOnly = ref(false)

  // Set up scale synchronization when canvas is available
  let originalOnChanged: ((scale: number, offset: Point) => void) | undefined =
    undefined
  const initScaleSync = () => {
    const ds = canvas.value?.ds
    if (!ds) return

    originalOnChanged = ds.onChanged
    updateAppScalePercentage(ds.scale)

    ds.onChanged = () => {
      if (ds.scale) {
        updateAppScalePercentage(ds.scale)
      }
      originalOnChanged?.(ds.scale, ds.offset)
    }
  }

  const cleanupScaleSync = () => {
    const ds = canvas.value?.ds
    if (!ds) return
    ds.onChanged = originalOnChanged
    originalOnChanged = undefined
  }

  const getCanvas = () => {
    if (!canvas.value) throw new Error('getCanvas: canvas is null')
    return canvas.value
  }

  /**
   * Sets the canvas zoom level from a percentage value
   * @param percentage - Zoom percentage value (1-1000, where 1000 = 1000% zoom)
   */
  const setAppZoomFromPercentage = (percentage: number) => {
    const currentCanvas = canvas.value
    if (!currentCanvas || percentage <= 0) return

    // Convert percentage to scale (1000% = 10.0 scale)
    const newScale = percentage / 100
    const { ds } = currentCanvas
    const { element } = ds

    ds.changeScale(newScale, [element.width / 2, element.height / 2])
    currentCanvas.setDirty(true, true)

    // Update reactive value immediately for UI consistency
    updateAppScalePercentage(newScale)
  }

  const currentGraph = shallowRef<LGraph | null>(null)
  const rootGraphId = computed(() => currentGraph.value?.rootGraph.id)
  const isInSubgraph = ref(false)
  const isGhostPlacing = ref(false)

  /** The selected items of the on-screen graph, derived from the selection store. */
  const selectedItems = computed<Positionable[]>(() => {
    const graph = currentGraph.value
    if (!graph) return []
    return selectionStore
      .selectedKeys(graphScopeOf(graph))
      .flatMap((key) => resolveSelectable(graph, key) ?? [])
  })

  const selectedNodeIds = computed<Set<NodeId>>(
    () =>
      new Set(selectedItems.value.filter(isLGraphNode).map((item) => item.id))
  )
  const highlightedNodeIds = ref<Set<NodeId>>(new Set())

  /** Emphasizes nodes without mutating the user's graph selection. */
  const setHighlightedNodeIds = (ids: Iterable<NodeId>) => {
    highlightedNodeIds.value = new Set(ids)
    const currentCanvas = canvas.value
    if (!currentCanvas) return
    currentCanvas.highlighted_node_ids = new Set(
      [...highlightedNodeIds.value].map(serializeNodeId)
    )
    currentCanvas.setDirty(true, false)
  }

  whenever(
    () => canvas.value,
    (newCanvas) => {
      currentGraph.value = newCanvas.graph
      newCanvas.highlighted_node_ids = new Set(
        [...highlightedNodeIds.value].map(serializeNodeId)
      )
      if (highlightedNodeIds.value.size > 0) newCanvas.setDirty(true, false)
      // Scoped to the on-screen graph: selection only holds items from it,
      // so removals in other graphs can't affect the live selection.
      useEventListener(
        () => currentGraph.value?.events,
        'node:before-removed',
        (e: CustomEvent<{ node: LGraphNode }>) => {
          newCanvas.deselect(e.detail.node)
        }
      )

      isReadOnly.value = newCanvas.read_only

      useEventListener(
        newCanvas.canvas,
        'litegraph:read-only-changed',
        (event: CustomEvent<{ readOnly: boolean }>) => {
          isReadOnly.value = event.detail.readOnly
        }
      )

      useEventListener(
        newCanvas.canvas,
        'litegraph:set-graph',
        (event: CustomEvent<{ newGraph?: LGraph; oldGraph: LGraph }>) => {
          const newGraph = event.detail.newGraph ?? newCanvas.graph // TODO: Ambiguous Graph
          currentGraph.value = newGraph
          isInSubgraph.value = Boolean(newCanvas.subgraph)
        }
      )

      useEventListener(newCanvas.canvas, 'subgraph-opened', () => {
        isInSubgraph.value = true
      })

      useEventListener(
        newCanvas.canvas,
        'subgraph-converted',
        (e: CustomEvent<{ subgraphNode: SubgraphNode }>) =>
          promoteRecommendedWidgets(e.detail.subgraphNode)
      )

      useEventListener(
        newCanvas.canvas,
        'litegraph:ghost-placement',
        (e: CustomEvent<{ active: boolean; nodeId: NodeId }>) => {
          isGhostPlacing.value = e.detail.active
          const graph = currentGraph.value
          if (e.detail.active && graph) {
            const mutations = useLayoutMutations(LayoutSource.Canvas)
            mutations.setNodeOrder(graph, e.detail.nodeId, 'front')
          }
        }
      )
    },
    { immediate: true }
  )

  return {
    canvas,
    selectedItems,
    selectedNodeIds,
    highlightedNodeIds,
    setHighlightedNodeIds,
    appScalePercentage,
    linearMode,
    isReadOnly,
    getCanvas,
    setAppZoomFromPercentage,
    initScaleSync,
    cleanupScaleSync,
    currentGraph,
    rootGraphId,
    isInSubgraph,
    isGhostPlacing
  }
})
