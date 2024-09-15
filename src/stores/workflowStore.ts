import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { ComfyWorkflow } from '@/scripts/workflows'

export const useWorkflowStore = defineStore('workflow', () => {
  const workflowLookup = ref<Record<string, ComfyWorkflow>>({})
  const workflows = computed(() => Object.values(workflowLookup.value))

  return {
    workflows,
    workflowLookup
  }
})
