import { defineStore } from 'pinia'
import { whenever } from '@vueuse/core'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'

export const useAppIOStore = defineStore('appIO', () => {
  const workflowStore = useWorkflowStore()
  const selectedInputs = ref<[NodeId, string][]>([])
  const selectedOutputs = ref<NodeId[]>([])

  whenever(
    () => workflowStore.activeWorkflow,
    (workflow) => {
      const { activeState } = workflow.changeTracker
      selectedInputs.value = activeState.extra?.linearData?.inputs ?? []
      selectedOutputs.value = activeState.extra?.linearData?.outputs ?? []
    },
    { immediate: true }
  )

  //FIXME type here is only on ComfyWorkflowJson, not an active graph
  whenever(selectedOutputs, (newVal) => {
    app.rootGraph.extra.linearData ??= {}
    ;(app.rootGraph.extra.linearData! as { outputs?: unknown }).outputs = [
      ...newVal
    ]
  })
  whenever(selectedInputs, (newVal) => {
    app.rootGraph.extra.linearData ??= {}
    ;(app.rootGraph.extra.linearData! as { inputs?: unknown }).inputs = [
      ...newVal
    ]
  })

  return {
    selectedInputs,
    selectedOutputs
  }
})
