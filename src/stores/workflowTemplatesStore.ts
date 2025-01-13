import { defineStore } from 'pinia'
import { ref } from 'vue'
import { computed } from 'vue'

import { CORE_TEMPLATES } from '@/constants/coreTemplates'
import { api } from '@/scripts/api'
import type { WorkflowTemplates } from '@/types/workflowTemplateTypes'

export const useWorkflowTemplatesStore = defineStore(
  'workflowTemplates',
  () => {
    const customTemplates = ref<{ [moduleName: string]: string[] }>({})
    const isLoaded = ref(false)
    const defaultTemplate = CORE_TEMPLATES[0]

    const templates = computed<WorkflowTemplates[]>(() => [
      ...CORE_TEMPLATES,
      ...Object.entries(customTemplates.value).map(
        ([moduleName, templates]) => ({
          moduleName,
          title: moduleName,
          templates
        })
      )
    ])

    async function loadWorkflowTemplates() {
      try {
        if (!isLoaded.value) {
          customTemplates.value = await api.getWorkflowTemplates()
          isLoaded.value = true
        }
      } catch (error) {
        console.error('Error fetching workflow templates:', error)
      }
    }

    return {
      templates,
      defaultTemplate,
      isLoaded,

      loadWorkflowTemplates
    }
  }
)
