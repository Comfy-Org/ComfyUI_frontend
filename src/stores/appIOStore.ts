import { defineStore } from 'pinia'
import { whenever } from '@vueuse/core'
import { ref } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export const useAppIOStore = defineStore('appIO', () => {
  const workflowStore = useWorkflowStore()
  const selectedInputs = ref<[NodeId, string][]>([])
  const selectedOutputs = ref<NodeId[]>([])

  whenever(
    () => workflowStore.activeWorkflow,
    (workflow) => {
      workflow.changeTracker.reset()

      const { activeState } = workflow.changeTracker
      selectedInputs.value = activeState.extra?.linearData?.inputs ?? []
      selectedOutputs.value = activeState.extra?.linearData?.outputs ?? []
    }
  )

  return {
    selectedInputs,
    selectedOutputs
  }
})
