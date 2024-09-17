import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ComfyWorkflow } from '@/scripts/workflows'
import { getStorageValue } from '@/scripts/utils'

export const useWorkflowStore = defineStore('workflow', () => {
  const activeWorkflow = ref<ComfyWorkflow | null>(null)
  const previousWorkflowUnsaved = ref<boolean>(
    Boolean(getStorageValue('Comfy.PreviousWorkflowUnsaved'))
  )

  return {
    activeWorkflow,
    previousWorkflowUnsaved
  }
})
