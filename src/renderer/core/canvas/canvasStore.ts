import { useEventListener, whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef, watch } from 'vue'
import type { Raw } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { setApiModeChecker } from '@/i18n'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import type { Point, Positionable } from '@/lib/litegraph/src/interfaces'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { promoteRecommendedWidgets } from '@/core/graph/subgraph/promotionUtils'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { app } from '@/scripts/app'
import { isLGraphGroup, isLGraphNode, isReroute } from '@/utils/litegraphUtil'

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
  /**
   * The selected items on the canvas. All stored items are raw.
   */
  const selectedItems = ref<Raw<Positionable>[]>([])
  const updateSelectedItems = () => {
    const items = Array.from(canvas.value?.selectedItems ?? [])
    selectedItems.value = items.map((item) => markRaw(item))
  }

  // Reactive scale percentage that syncs with app.canvas.ds.scale
  const appScalePercentage = ref(100)
  const updateAppScalePercentage = (scale: number) => {
    appScalePercentage.value = Math.round(scale * 100)
  }

  const { isAppMode, isApiMode, isBuilderMode, setMode } = useAppMode()
  const workflowStore = useWorkflowStore()

  // Whether the active workflow already has linear data, i.e. the app/API has
  // already been built. When true, entering app/API mode opens the result
  // (the app preview / generated Swagger) instead of the builder/preview.
  function activeWorkflowHasLinearData(): boolean {
    const linearData =
      workflowStore.activeWorkflow?.changeTracker?.activeState?.extra
        ?.linearData
    return (
      (linearData?.inputs?.length ?? 0) > 0 ||
      (linearData?.outputs?.length ?? 0) > 0
    )
  }

  const linearMode = computed({
    get: () => isAppMode.value,
    set: (val: boolean) => {
      setMode(val ? 'app' : 'graph')
    }
  })
  // When true, API mode renders the generated Swagger ("View API" result)
  // instead of the API builder/preview. Set by the builder's "View API" action,
  // or when entering API mode for a workflow that's already been built.
  const apiShowSwagger = ref(false)
  const apiMode = computed({
    get: () => isApiMode.value,
    set: (val: boolean) => {
      apiShowSwagger.value = val && activeWorkflowHasLinearData()
      setMode(val ? 'api' : 'graph')
    }
  })
  watch(isApiMode, (inApi) => {
    if (!inApi) apiShowSwagger.value = false
  })

  // The builder is shared between App mode and API mode. Track whether the
  // current builder session was entered from API mode so labels can stay "API".
  // Set by `appModeStore.enterBuilder`; auto-cleared when leaving builder mode.
  const builderEnteredFromApi = ref(false)
  watch(isBuilderMode, (inBuilder) => {
    if (!inBuilder) builderEnteredFromApi.value = false
  })

  // Let i18n rewrite "App" wording to "API" while API mode (or an API builder
  // session) is active. Reading the refs inside the checker keeps translations
  // reactive to mode changes.
  setApiModeChecker(
    () => apiMode.value || (isBuilderMode.value && builderEnteredFromApi.value)
  )

  // Set up scale synchronization when canvas is available
  let originalOnChanged: ((scale: number, offset: Point) => void) | undefined =
    undefined
  const initScaleSync = () => {
    if (app.canvas?.ds) {
      // Initial sync
      originalOnChanged = app.canvas.ds.onChanged
      updateAppScalePercentage(app.canvas.ds.scale)

      // Set up continuous sync
      app.canvas.ds.onChanged = () => {
        if (app.canvas?.ds?.scale) {
          updateAppScalePercentage(app.canvas.ds.scale)
        }
        // Call original handler if exists
        originalOnChanged?.(app.canvas.ds.scale, app.canvas.ds.offset)
      }
    }
  }

  const cleanupScaleSync = () => {
    if (app.canvas?.ds) {
      app.canvas.ds.onChanged = originalOnChanged
      originalOnChanged = undefined
    }
  }

  const nodeSelected = computed(() => selectedItems.value.some(isLGraphNode))
  const groupSelected = computed(() => selectedItems.value.some(isLGraphGroup))
  const rerouteSelected = computed(() => selectedItems.value.some(isReroute))

  const getCanvas = () => {
    if (!canvas.value) throw new Error('getCanvas: canvas is null')
    return canvas.value
  }

  /**
   * Sets the canvas zoom level from a percentage value
   * @param percentage - Zoom percentage value (1-1000, where 1000 = 1000% zoom)
   */
  const setAppZoomFromPercentage = (percentage: number) => {
    if (!app.canvas?.ds || percentage <= 0) return

    // Convert percentage to scale (1000% = 10.0 scale)
    const newScale = percentage / 100
    const ds = app.canvas.ds

    ds.changeScale(
      newScale,
      ds.element ? [ds.element.width / 2, ds.element.height / 2] : undefined
    )
    app.canvas.setDirty(true, true)

    // Update reactive value immediately for UI consistency
    updateAppScalePercentage(newScale)
  }

  const currentGraph = shallowRef<LGraph | null>(null)
  const isInSubgraph = ref(false)
  const isGhostPlacing = ref(false)

  // Provide selection state to all Vue nodes
  const selectedNodeIds = computed(
    () =>
      new Set(
        selectedItems.value
          .filter((item) => item.id !== undefined && isLGraphNode(item))
          .map((item) => String(item.id))
      )
  )

  whenever(
    () => canvas.value,
    (newCanvas) => {
      currentGraph.value = newCanvas.graph
      // Scoped to the on-screen graph: selection only holds items from it,
      // so removals in other graphs can't affect the live selection.
      useEventListener(
        () => currentGraph.value?.events,
        'node:before-removed',
        (e: CustomEvent<{ node: LGraphNode }>) => {
          newCanvas.deselect(e.detail.node)
          updateSelectedItems()
        }
      )

      useEventListener(
        newCanvas.canvas,
        'litegraph:set-graph',
        (event: CustomEvent<{ newGraph: LGraph; oldGraph: LGraph }>) => {
          const newGraph = event.detail?.newGraph ?? app.canvas?.graph // TODO: Ambiguous Graph
          currentGraph.value = newGraph
          isInSubgraph.value = Boolean(app.canvas?.subgraph)
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
          if (e.detail.active) {
            const mutations = useLayoutMutations()
            mutations.bringNodeToFront(String(e.detail.nodeId))
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
    nodeSelected,
    groupSelected,
    rerouteSelected,
    appScalePercentage,
    linearMode,
    apiMode,
    apiShowSwagger,
    builderEnteredFromApi,
    updateSelectedItems,
    getCanvas,
    setAppZoomFromPercentage,
    initScaleSync,
    cleanupScaleSync,
    currentGraph,
    isInSubgraph,
    isGhostPlacing
  }
})
