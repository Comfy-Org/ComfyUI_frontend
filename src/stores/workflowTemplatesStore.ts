import { defineStore } from 'pinia'
import { ref } from 'vue'

import { api } from '@/scripts/api'

export const useWorkflowTemplatesStore = defineStore(
  'workflowTemplates',
  () => {
    const items = ref<{
      [customNodesName: string]: string[]
    }>({})
    const isLoaded = ref(false)

    async function loadWorkflowTemplates() {
      try {
        if (!isLoaded.value) {
          items.value = await api.getWorkflowTemplates()
          isLoaded.value = true
        }
      } catch (error) {
        console.error('Error fetching workflow templates:', error)
      }
    }

    return {
      items,
      isLoaded,
      loadWorkflowTemplates
    }
  }
)
