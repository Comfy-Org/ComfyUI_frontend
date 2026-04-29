import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

import { useEmptyWorkflowDialog } from '@/components/builder/useEmptyWorkflowDialog'
import { useAppMode } from '@/composables/useAppMode'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  BlockRow,
  PanelPreset
} from '@/components/appMode/layout/panels/panelTypes'
import type {
  InputWidgetConfig,
  LinearData,
  LinearInput
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { resolveNode } from '@/utils/litegraphUtil'

export function nodeTypeValidForApp(type: string) {
  return !['Note', 'MarkdownNote'].includes(type)
}

/**
 * Single source of truth for App Mode and App Builder — panel preset,
 * collapse, width, block arrangement, selected inputs + outputs. Both
 * modes render through the same chrome + floating panel and read and
 * write here, so the builder is WYSIWYG with the runtime by
 * construction rather than by translation.
 */
export const useAppModeStore = defineStore('appMode', () => {
  const { getCanvas } = useCanvasStore()
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  const { mode, setMode, isBuilderMode, isSelectMode } = useAppMode()
  const emptyWorkflowDialog = useEmptyWorkflowDialog()

  const showVueNodeSwitchPopup = ref(false)

  const selectedInputs = ref<LinearInput[]>([])
  const selectedOutputs = ref<NodeId[]>([])

  // Viewport pan/zoom — the output workspace's scale + offset. Single
  // source of truth so the nav cluster in AppChrome and the wheel/drag
  // handlers on the workspace wrapper mutate the same state, and the
  // transform on the media preview reads back out of it. Applied as a
  // CSS `transform: translate(offset) scale(scale)` on the element that
  // hosts the preview; math below keeps "zoom around cursor" coherent.
  const viewportScale = ref(1)
  const viewportOffsetX = ref(0)
  const viewportOffsetY = ref(0)
  // Clamp range — zoom-out past 0.1x makes the image a dot; past 8x the
  // pixels get blocky and pan math becomes unwieldy. These bounds cover
  // every realistic inspection use case.
  const MIN_SCALE = 0.1
  const MAX_SCALE = 8

  function clampScale(s: number): number {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s))
  }

  // Zoom around a focal point (cursor position) so the pixel under the
  // cursor stays under the cursor after the scale change. `rect` is the
  // bounding box of the element the client coords were measured against.
  function zoomAt(
    clientX: number,
    clientY: number,
    deltaY: number,
    rect: { left: number; top: number; width: number; height: number }
  ) {
    cancelFlyTo()
    const prevScale = viewportScale.value
    // 1.1 ** (delta / -30) matches ZoomPane's original responsiveness so
    // wheel feel doesn't change between the old in-pane zoom and the new
    // workspace-wide zoom.
    const nextScale = clampScale(prevScale * 1.1 ** (deltaY / -30))
    if (nextScale === prevScale) return
    const cx = clientX - rect.left - rect.width / 2
    const cy = clientY - rect.top - rect.height / 2
    const ratio = nextScale / prevScale
    viewportOffsetX.value = viewportOffsetX.value * ratio - cx * (ratio - 1)
    viewportOffsetY.value = viewportOffsetY.value * ratio - cy * (ratio - 1)
    viewportScale.value = nextScale
  }

  function panBy(dx: number, dy: number) {
    cancelFlyTo()
    viewportOffsetX.value += dx
    viewportOffsetY.value += dy
  }

  // Step zoom (nav-cluster buttons) — anchors at workspace center, which
  // is the natural focal point when there's no cursor position driving
  // the change.
  function zoomStep(factor: number) {
    cancelFlyTo()
    const prevScale = viewportScale.value
    const nextScale = clampScale(prevScale * factor)
    if (nextScale === prevScale) return
    const ratio = nextScale / prevScale
    viewportOffsetX.value = viewportOffsetX.value * ratio
    viewportOffsetY.value = viewportOffsetY.value * ratio
    viewportScale.value = nextScale
  }

  function zoomIn() {
    zoomStep(1.2)
  }

  function zoomOut() {
    zoomStep(1 / 1.2)
  }

  function resetView() {
    cancelFlyTo()
    viewportScale.value = 1
    viewportOffsetX.value = 0
    viewportOffsetY.value = 0
  }

  // Active flyTo animation handle so a second call (or a manual
  // pan/zoom) can interrupt the prior tween mid-flight.
  let flyAnimationId: number | null = null
  function cancelFlyTo() {
    if (flyAnimationId !== null) {
      cancelAnimationFrame(flyAnimationId)
      flyAnimationId = null
    }
  }

  // Smoothly center the viewport on a workspace rect. Keeps the
  // current zoom unless it's WAY out (< 0.5×) or WAY in (> 2×),
  // in which case it eases toward 1×.
  function flyTo(
    target: { x: number; y: number; width: number; height: number },
    options?: {
      duration?: number
      viewportWidth?: number
      viewportHeight?: number
    }
  ) {
    cancelFlyTo()
    const duration = options?.duration ?? 450
    const vw = options?.viewportWidth ?? window.innerWidth
    const vh = options?.viewportHeight ?? window.innerHeight

    const cx = target.x + target.width / 2
    const cy = target.y + target.height / 2

    const fromScale = viewportScale.value
    const toScale = fromScale < 0.5 || fromScale > 2 ? clampScale(1) : fromScale

    // From the workspace transform: screenX = vw/2 + (cx - vw/2)*scale + offsetX
    // For screenX = vw/2 (center), offsetX = (vw/2 - cx) * scale.
    const toX = (vw / 2 - cx) * toScale
    const toY = (vh / 2 - cy) * toScale

    const fromX = viewportOffsetX.value
    const fromY = viewportOffsetY.value

    const start = performance.now()
    const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t)

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const k = easeInOut(t)
      viewportOffsetX.value = fromX + (toX - fromX) * k
      viewportOffsetY.value = fromY + (toY - fromY) * k
      viewportScale.value = fromScale + (toScale - fromScale) * k
      flyAnimationId = t < 1 ? requestAnimationFrame(tick) : null
    }
    flyAnimationId = requestAnimationFrame(tick)
  }

  // Shared panel position + collapse state — single source of truth so
  // moving / collapsing the panel in either view updates both. Persisted
  // to the workflow via `extra.linearData.layout` (see watch below).
  const panelPreset = ref<PanelPreset>('right-dock')
  const panelCollapsed = ref(false)
  // Width of the dock panel in grid cells (8 = default 440px). Bumping
  // this grows the panel by one cell + gutter per step (56px). Float
  // presets ignore this; they stay at the default 8-cell width.
  const panelWidthCells = ref(8)
  // Block layout inside the panel, shared with the builder's arrange step
  // for the same WYSIWYG reason — rearranging in either view mutates the
  // same 2D grid. Reconciliation against selectedInputs lives in
  // useAppPanelLayout so the store stays free of graph-resolution code.
  const panelRows = ref<BlockRow[]>([])
  const hasOutputs = computed(() => !!selectedOutputs.value.length)
  const hasNodes = computed(() => {
    // Nodes are not reactive, so trigger recomputation when workflow changes
    void workflowStore.activeWorkflow
    void mode.value
    return !!app.rootGraph?.nodes?.length
  })

  // Prune entries referencing nodes deleted in workflow mode.
  // Only check node existence, not widgets — dynamic widgets can
  // hide/show other widgets so a missing widget does not mean stale data.
  function pruneLinearData(data: Partial<LinearData> | undefined): LinearData {
    const rawInputs = data?.inputs ?? []
    const rawOutputs = data?.outputs ?? []

    return {
      inputs: app.rootGraph
        ? rawInputs.filter(([nodeId]) => resolveNode(nodeId))
        : rawInputs,
      outputs: app.rootGraph
        ? rawOutputs.filter((nodeId) => resolveNode(nodeId))
        : rawOutputs
    }
  }

  function loadSelections(data: Partial<LinearData> | undefined) {
    const { inputs, outputs } = pruneLinearData(data)
    selectedInputs.value = inputs
    selectedOutputs.value = outputs

    const layout = data?.layout
    if (!layout) return
    if (layout.panelPreset) panelPreset.value = layout.panelPreset
    if (typeof layout.panelCollapsed === 'boolean')
      panelCollapsed.value = layout.panelCollapsed
    if (layout.panelWidthCells) panelWidthCells.value = layout.panelWidthCells
    if (layout.panelRows) panelRows.value = layout.panelRows
  }

  function resetSelectedToWorkflow() {
    const { activeWorkflow } = workflowStore
    if (!activeWorkflow) return

    loadSelections(activeWorkflow.changeTracker?.activeState?.extra?.linearData)
  }

  useEventListener(
    () => app.rootGraph?.events,
    'configured',
    resetSelectedToWorkflow
  )

  // Builder-only writes: inputs, outputs, and the block arrangement
  // inside the panel. Block reorder is gated to builder by PanelBlockList,
  // so panelRows only mutates here.
  watch(
    () =>
      isBuilderMode.value
        ? {
            inputs: selectedInputs.value,
            outputs: selectedOutputs.value,
            panelRows: panelRows.value
          }
        : null,
    (data) => {
      if (!data || ChangeTracker.isLoadingGraph) return
      const graph = app.rootGraph
      if (!graph) return
      const extra = (graph.extra ??= {})
      const linearData: Partial<LinearData> = (extra.linearData ??= {})
      linearData.inputs = [...data.inputs]
      linearData.outputs = [...data.outputs]
      linearData.layout = {
        ...(linearData.layout ?? {}),
        panelRows: data.panelRows.map((row) => row.map((b) => ({ ...b })))
      }
      workflowStore.activeWorkflow?.changeTracker?.captureCanvasState()
    },
    { deep: true }
  )

  // Persist panel layout. Fires from both App Mode and Builder so a
  // user dragging the panel in either view writes back to the workflow.
  watch(
    () => ({
      panelPreset: panelPreset.value,
      panelCollapsed: panelCollapsed.value,
      panelWidthCells: panelWidthCells.value
    }),
    (layout) => {
      if (ChangeTracker.isLoadingGraph) return
      const graph = app.rootGraph
      if (!graph) return
      const extra = (graph.extra ??= {})
      const linearData: Partial<LinearData> = (extra.linearData ??= {})
      linearData.layout = { ...(linearData.layout ?? {}), ...layout }
      workflowStore.activeWorkflow?.changeTracker?.captureCanvasState()
    }
  )

  let unwatchReadOnly: (() => void) | undefined
  function enforceReadOnly(inSelect: boolean) {
    const { state } = getCanvas()
    if (!state) return
    state.readOnly = inSelect
    unwatchReadOnly?.()
    if (inSelect)
      unwatchReadOnly = watch(
        () => state.readOnly,
        () => (state.readOnly = true)
      )
  }

  function autoEnableVueNodes(inSelect: boolean) {
    if (!inSelect) return
    if (!settingStore.get('Comfy.VueNodes.Enabled')) {
      void settingStore.set('Comfy.VueNodes.Enabled', true)

      if (!settingStore.get('Comfy.AppBuilder.VueNodeSwitchDismissed')) {
        showVueNodeSwitchPopup.value = true
      }
    }
  }

  watch(isSelectMode, (inSelect) => {
    enforceReadOnly(inSelect)
    autoEnableVueNodes(inSelect)
  })

  // Hide litegraph's canvas info overlay (T:/I:/N:/V:/FPS + "Comfy Cloud"
  // info_text, all rendered as canvas text at the bottom-left) while in
  // builder mode — it collides with FeedbackCell and is debug noise for
  // authors building the App surface. Save the pre-builder value so
  // exiting restores whatever the user had.
  let preBuilderShowInfo: boolean | undefined
  watch(isBuilderMode, (inBuilder) => {
    const canvas = getCanvas()
    if (!canvas) return
    if (inBuilder) {
      if (preBuilderShowInfo === undefined) {
        preBuilderShowInfo = canvas.show_info
      }
      canvas.show_info = false
    } else if (preBuilderShowInfo !== undefined) {
      canvas.show_info = preBuilderShowInfo
      preBuilderShowInfo = undefined
    }
  })

  function enterBuilder() {
    if (!hasNodes.value) {
      emptyWorkflowDialog.show({
        onEnterBuilder: () => enterBuilder(),
        onDismiss: () => setMode('graph')
      })
      return
    }

    // Prune stale references
    resetSelectedToWorkflow()

    setMode(
      mode.value === 'app' && hasOutputs.value
        ? 'builder:arrange'
        : 'builder:inputs'
    )
  }

  function exitBuilder() {
    resetSelectedToWorkflow()
    setMode('graph')
  }

  function removeSelectedInput(widget: IBaseWidget, node: { id: NodeId }) {
    const storeId = isPromotedWidgetView(widget) ? widget.sourceNodeId : node.id
    const storeName = isPromotedWidgetView(widget)
      ? widget.sourceWidgetName
      : widget.name
    const index = selectedInputs.value.findIndex(
      ([id, name]) => String(storeId) === String(id) && storeName === name
    )
    if (index !== -1) selectedInputs.value.splice(index, 1)
  }

  // Toggle helpers — single entry points for selection mutations so
  // callers (AppBuilder click handlers, AppInput / AppOutput overlays)
  // don't manipulate the arrays directly. Keeps the surface aligned
  // with the repo's command-pattern guidance and gives us a single
  // place to add undo / replay later.
  function toggleSelectedOutput(id: NodeId) {
    const index = selectedOutputs.value.findIndex(
      (k) => String(k) === String(id)
    )
    if (index === -1) selectedOutputs.value.push(id)
    else selectedOutputs.value.splice(index, 1)
  }

  function removeSelectedOutput(id: NodeId) {
    const index = selectedOutputs.value.findIndex(
      (k) => String(k) === String(id)
    )
    if (index !== -1) selectedOutputs.value.splice(index, 1)
  }

  function toggleSelectedInput(nodeId: NodeId, widgetName: string) {
    const index = selectedInputs.value.findIndex(
      ([id, name]) => String(id) === String(nodeId) && name === widgetName
    )
    if (index === -1) selectedInputs.value.push([nodeId, widgetName])
    else selectedInputs.value.splice(index, 1)
  }

  function updateInputConfig(
    nodeId: NodeId,
    widgetName: string,
    config: InputWidgetConfig
  ) {
    const entry = selectedInputs.value.find(
      ([id, name]) => String(nodeId) === String(id) && widgetName === name
    )
    if (!entry) return
    entry[2] = { ...entry[2], ...config }
  }

  return {
    enterBuilder,
    exitBuilder,
    flyTo,
    hasNodes,
    hasOutputs,
    loadSelections,
    panelCollapsed,
    panelPreset,
    panelRows,
    panelWidthCells,
    panBy,
    pruneLinearData,
    removeSelectedInput,
    removeSelectedOutput,
    resetSelectedToWorkflow,
    resetView,
    selectedInputs,
    selectedOutputs,
    showVueNodeSwitchPopup,
    toggleSelectedInput,
    toggleSelectedOutput,
    updateInputConfig,
    viewportOffsetX,
    viewportOffsetY,
    viewportScale,
    zoomAt,
    zoomIn,
    zoomOut
  }
})
