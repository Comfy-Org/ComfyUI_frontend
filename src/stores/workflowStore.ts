import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ComfyWorkflow } from '@/scripts/workflows'
import { getStorageValue } from '@/scripts/utils'

export const useWorkflowStore = defineStore('workflow', () => {
  const activeWorkflow = ref<ComfyWorkflow | null>(null)
  const previousWorkflowUnsaved = ref<boolean>(
    Boolean(getStorageValue('Comfy.PreviousWorkflowUnsaved'))
  )

  const workflowLookup = ref<Record<string, ComfyWorkflow>>({})
  const workflows = computed(() => Object.values(workflowLookup.value))
  const openWorkflows = ref<ComfyWorkflow[]>([])

  return {
    activeWorkflow,
    previousWorkflowUnsaved,
    workflows,
    openWorkflows,
    workflowLookup
  }
})
