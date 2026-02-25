import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { t } from '@/i18n'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useDialogService } from '@/services/dialogService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'

export const useAppModeStore = defineStore('appMode', () => {
  const { getCanvas } = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const { mode, setMode } = useAppMode()

  const selectedInputs = reactive<[NodeId, string][]>([])
  const selectedOutputs = reactive<NodeId[]>([])
  const hasOutputs = computed(() => !!selectedOutputs.length)

  function loadSelections(
    data: { inputs?: [NodeId, string][]; outputs?: NodeId[] } | undefined
  ) {
    selectedInputs.splice(0, selectedInputs.length, ...(data?.inputs ?? []))
    selectedOutputs.splice(0, selectedOutputs.length, ...(data?.outputs ?? []))
  }

  function resetSelectedToWorkflow() {
    const { activeWorkflow } = workflowStore
    if (!activeWorkflow) return

    loadSelections(activeWorkflow.changeTracker?.activeState?.extra?.linearData)
  }

  function saveSelectedToWorkflow() {
    app.rootGraph.extra ??= {}
    app.rootGraph.extra.linearData = {
      inputs: [...selectedInputs],
      outputs: [...selectedOutputs]
    }
    const workflow = workflowStore.activeWorkflow
    if (workflow) workflow.dirtyLinearData = null
  }

  watch(
    () => workflowStore.activeWorkflow,
    (newWorkflow, oldWorkflow) => {
      // Persist in-progress builder selections to the outgoing workflow
      if (oldWorkflow) {
        oldWorkflow.dirtyLinearData = {
          inputs: [...selectedInputs],
          outputs: [...selectedOutputs]
        }
      }
      // Load from incoming workflow: dirty state first, then persisted
      if (newWorkflow) {
        loadSelections(
          newWorkflow.dirtyLinearData ??
            newWorkflow.changeTracker?.activeState?.extra?.linearData
        )
      } else {
        loadSelections(undefined)
      }
    },
    { immediate: true }
  )

  watch(
    () => mode.value === 'builder:select',
    (inSelect) => (getCanvas().read_only = inSelect)
  )

  async function exitBuilder() {
    if (
      !(await useDialogService().confirm({
        title: t('linearMode.builder.exitConfirmTitle'),
        message: t('linearMode.builder.exitConfirmMessage')
      }))
    )
      return

    const workflow = workflowStore.activeWorkflow
    if (workflow) workflow.dirtyLinearData = null
    resetSelectedToWorkflow()
    setMode('graph')
  }

  return {
    exitBuilder,
    hasOutputs,
    resetSelectedToWorkflow,
    saveSelectedToWorkflow,
    selectedInputs,
    selectedOutputs
  }
})
