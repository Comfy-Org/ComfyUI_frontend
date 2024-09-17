import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ComfyWorkflow } from '@/scripts/workflows'

export const useWorkflowStore = defineStore('workflow', () => {
  const activeWorkflow = ref<ComfyWorkflow | null>(null)

  return {
    activeWorkflow
  }
})
