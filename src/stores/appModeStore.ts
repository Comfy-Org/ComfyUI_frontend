import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LinearData } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'

export const useAppModeStore = defineStore('appMode', () => {
  const { getCanvas } = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const { mode, setMode, isBuilderMode } = useAppMode()

  const selectedInputs = reactive<[NodeId, string][]>([])
  const selectedOutputs = reactive<NodeId[]>([])
  const hasOutputs = computed(() => !!selectedOutputs.length)

  function loadSelections(data: Partial<LinearData> | undefined) {
    selectedInputs.splice(0, selectedInputs.length, ...(data?.inputs ?? []))
    selectedOutputs.splice(0, selectedOutputs.length, ...(data?.outputs ?? []))
  }

  function resetSelectedToWorkflow() {
    const { activeWorkflow } = workflowStore
    if (!activeWorkflow) return

    loadSelections(activeWorkflow.changeTracker?.activeState?.extra?.linearData)
  }

  watch(
    () => workflowStore.activeWorkflow,
    (newWorkflow) => {
      if (newWorkflow) {
        loadSelections(
          newWorkflow.changeTracker?.activeState?.extra?.linearData
        )
      } else {
        loadSelections(undefined)
      }
    },
    { immediate: true }
  )

  watch(
    () =>
      isBuilderMode.value
        ? { inputs: selectedInputs, outputs: selectedOutputs }
        : null,
    (data) => {
      if (!data) return
      const graph = app.rootGraph
      if (!graph) return
      const extra = (graph.extra ??= {})
      extra.linearData = {
        inputs: [...data.inputs],
        outputs: [...data.outputs]
      }
    },
    { deep: true }
  )

  watch(
    () => mode.value === 'builder:select',
    (inSelect) => (getCanvas().read_only = inSelect)
  )

  function enterBuilder() {
    setMode(
      mode.value === 'app' && hasOutputs.value
        ? 'builder:arrange'
        : 'builder:select'
    )
  }

  async function exitBuilder() {
    resetSelectedToWorkflow()
    setMode('graph')
  }

  return {
    enterBuilder,
    exitBuilder,
    hasOutputs,
    resetSelectedToWorkflow,
    selectedInputs,
    selectedOutputs
  }
})
