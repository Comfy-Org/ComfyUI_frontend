import { defineStore } from 'pinia'
import { whenever } from '@vueuse/core'
import { reactive, watch } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'

export const useAppIOStore = defineStore('appIO', () => {
  const workflowStore = useWorkflowStore()
  const selectedInputs = reactive<[NodeId, string][]>([])
  const selectedOutputs = reactive<NodeId[]>([])

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
    selectedInputs,
    selectedOutputs
  }
})
