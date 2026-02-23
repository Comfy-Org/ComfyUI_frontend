import { defineStore } from 'pinia'
import { whenever } from '@vueuse/core'
import { reactive, readonly, computed, ref, watch } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'

export type AppMode = 'graph' | 'app' | 'builder:select' | 'builder:arrange'

export const useAppModeStore = defineStore('appMode', () => {
  const workflowStore = useWorkflowStore()

  const selectedInputs = reactive<[NodeId, string][]>([])
  const selectedOutputs = reactive<NodeId[]>([])
  const mode = ref<AppMode>('graph')
  const builderSaving = ref(false)
  const hasOutputs = computed(() => !!selectedOutputs.length)
  const enableAppBuilder = ref(false)

  const isBuilderMode = computed(
    () => mode.value === 'builder:select' || mode.value === 'builder:arrange'
  )
  const isAppMode = computed(
    () => mode.value === 'app' || mode.value === 'builder:arrange'
  )
  const isGraphMode = computed(
    () => mode.value === 'graph' || mode.value === 'builder:select'
  )
  const isBuilderSaving = computed(
    () => builderSaving.value && isBuilderMode.value
  )

  whenever(
    () => workflowStore.activeWorkflow,
    (workflow) => {
      const { activeState } = workflow.changeTracker
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
    },
    { immediate: true }
  )

  //FIXME type here is only on ComfyWorkflowJson, not an active graph
  watch(selectedOutputs, () => {
    app.rootGraph.extra.linearData ??= {}
    ;(app.rootGraph.extra.linearData! as { outputs?: unknown }).outputs = [
      ...selectedOutputs
    ]
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  })
  watch(selectedInputs, () => {
    app.rootGraph.extra.linearData ??= {}
    ;(app.rootGraph.extra.linearData! as { inputs?: unknown }).inputs = [
      ...selectedInputs
    ]
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  })

  return {
    mode: readonly(mode),
    enableAppBuilder: readonly(enableAppBuilder),
    isBuilderMode,
    isAppMode,
    isGraphMode,
    isBuilderSaving,
    hasOutputs,
    selectedInputs,
    selectedOutputs,
    setBuilderSaving: (newBuilderSaving: boolean) => {
      if (!isBuilderMode.value) return
      builderSaving.value = newBuilderSaving
    },
    setMode: (newMode: AppMode) => {
      if (newMode === mode.value) return
      mode.value = newMode
    }
  }
})
