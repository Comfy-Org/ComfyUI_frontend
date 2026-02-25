import { defineStore } from 'pinia'
import { whenever } from '@vueuse/core'
import { reactive, computed, ref, watch } from 'vue'

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
  const { mode, setMode, isBuilderMode } = useAppMode()

  const selectedInputs = reactive<[NodeId, string][]>([])
  const selectedOutputs = reactive<NodeId[]>([])
  const builderSaving = ref(false)
  const hasOutputs = computed(() => !!selectedOutputs.length)

  const isBuilderSaving = computed(
    () => builderSaving.value && isBuilderMode.value
  )

  function resetSelectedToWorkflow() {
    const { activeWorkflow } = workflowStore
    if (!activeWorkflow) return

    const { activeState } = activeWorkflow.changeTracker
    selectedInputs.splice(
      0,
      selectedInputs.length,
      ...(activeState.extra?.linearData?.inputs ?? [])
    )
    selectedOutputs.splice(
      0,
      selectedOutputs.length,
      ...(activeState.extra?.linearData?.outputs ?? [])
    )
  }
  function saveSelectedToWorkflow() {
    app.rootGraph.extra ??= {}
    app.rootGraph.extra.linearData = {
      inputs: [...selectedInputs],
      outputs: [...selectedOutputs]
    }
  }
  whenever(() => workflowStore.activeWorkflow, resetSelectedToWorkflow, {
    immediate: true
  })

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

    resetSelectedToWorkflow()
    setMode('graph')
  }

  return {
    exitBuilder,
    isBuilderSaving,
    hasOutputs,
    resetSelectedToWorkflow,
    saveSelectedToWorkflow,
    selectedInputs,
    selectedOutputs,
    setBuilderSaving: (newBuilderSaving: boolean) => {
      if (!isBuilderMode.value) return
      builderSaving.value = newBuilderSaving
    }
  }
})
