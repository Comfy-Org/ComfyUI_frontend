import { groupBy } from 'lodash'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { CORE_TEMPLATES } from '@/constants/coreTemplates'
import { api } from '@/scripts/api'
import type {
  TemplateGroup,
  WorkflowTemplates
} from '@/types/workflowTemplateTypes'

export const useWorkflowTemplatesStore = defineStore(
  'workflowTemplates',
  () => {
    const customTemplates = shallowRef<{ [moduleName: string]: string[] }>({})
    const isLoaded = ref(false)
    const defaultTemplate: WorkflowTemplates = CORE_TEMPLATES[0]

    const groupedTemplates = computed<TemplateGroup[]>(() => {
      const allTemplates = [
        ...CORE_TEMPLATES,
        ...Object.entries(customTemplates.value).map(
          ([moduleName, templates]) => ({
            moduleName,
            title: moduleName,
            templates: templates.map((name) => ({
              name,
              mediaType: 'image',
              mediaSubtype: 'jpg'
            }))
          })
        )
      ]

      return Object.entries(
        groupBy(allTemplates, (t) =>
          t.moduleName === 'default' ? 'ComfyUI Examples' : 'Custom Nodes'
        )
      ).map(([label, modules]) => ({ label, modules }))
    })

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
      groupedTemplates,
      defaultTemplate,
      isLoaded,
      loadWorkflowTemplates
    }
  }
)
