import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

import { useEmptyWorkflowDialog } from '@/components/builder/useEmptyWorkflowDialog'
import { useAppMode } from '@/composables/useAppMode'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type {
  InputWidgetConfig,
  LinearData,
  LinearInput
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import {
  getSelectedWidgetIdentity,
  resolveNode,
  resolveNodeWidget
} from '@/utils/litegraphUtil'

export function nodeTypeValidForApp(type: string) {
  return !['Note', 'MarkdownNote'].includes(type)
}

export const useAppModeStore = defineStore('appMode', () => {
  const { getCanvas } = useCanvasStore()
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  const { mode, setMode, isBuilderMode, isSelectMode } = useAppMode()
  const emptyWorkflowDialog = useEmptyWorkflowDialog()

  const showVueNodeSwitchPopup = ref(false)

  const selectedInputs = ref<LinearInput[]>([])
  const selectedOutputs = ref<NodeId[]>([])
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
  function normalizeSelectedInput(input: LinearInput): LinearInput {
    const [nodeId, widgetName, config] = input
    if (!app.rootGraph) return input

    const resolved = resolveNodeWidget(nodeId, widgetName, app.rootGraph)
    if (resolved.length < 2) return input

    const node = resolved[0]
    const widget = resolved[1]
    if (!node || !widget) return input

    const [canonicalNodeId, canonicalWidgetName] = getSelectedWidgetIdentity(
      node,
      widget
    )
    return config === undefined
      ? [canonicalNodeId, canonicalWidgetName]
      : [canonicalNodeId, canonicalWidgetName, config]
  }

  function pruneLinearData(data: Partial<LinearData> | undefined): LinearData {
    const rawInputs = data?.inputs ?? []
    const rawOutputs = data?.outputs ?? []
    const normalizedInputs = app.rootGraph
      ? rawInputs.map(normalizeSelectedInput)
      : rawInputs

    return {
      inputs: app.rootGraph
        ? normalizedInputs.filter(([nodeId]) => resolveNode(nodeId))
        : normalizedInputs,
      outputs: app.rootGraph
        ? rawOutputs.filter((nodeId) => resolveNode(nodeId))
        : rawOutputs
    }
  }

  function loadSelections(data: Partial<LinearData> | undefined) {
    const { inputs, outputs } = pruneLinearData(data)
    selectedInputs.value = inputs
    selectedOutputs.value = outputs
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

  watch(
    () =>
      isBuilderMode.value
        ? { inputs: selectedInputs.value, outputs: selectedOutputs.value }
        : null,
    (data) => {
      if (!data || ChangeTracker.isLoadingGraph) return
      const graph = app.rootGraph
      if (!graph) return
      const extra = (graph.extra ??= {})
      extra.linearData = {
        inputs: [...data.inputs],
        outputs: [...data.outputs]
      }
      workflowStore.activeWorkflow?.changeTracker?.captureCanvasState()
    },
    { deep: true }
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

    useSidebarTabStore().activeSidebarTabId = null

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

  function removeSelectedInput(widget: IBaseWidget, node: LGraphNode) {
    const [storeId, storeName] = getSelectedWidgetIdentity(node, widget)
    const index = selectedInputs.value.findIndex(
      ([id, name]) => storeId == id && storeName === name
    )
    if (index !== -1) selectedInputs.value.splice(index, 1)
  }

  function updateInputConfig(
    nodeId: NodeId,
    widgetName: string,
    config: InputWidgetConfig
  ) {
    const entry = selectedInputs.value.find(
      ([id, name]) => nodeId == id && widgetName === name
    )
    if (!entry) return
    entry[2] = { ...entry[2], ...config }
  }

  return {
    enterBuilder,
    exitBuilder,
    hasNodes,
    hasOutputs,
    loadSelections,
    pruneLinearData,
    removeSelectedInput,
    resetSelectedToWorkflow,
    selectedInputs,
    selectedOutputs,
    updateInputConfig,
    showVueNodeSwitchPopup
  }
})
