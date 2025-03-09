import { groupBy } from 'lodash'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/scripts/api'
import type {
  TemplateGroup,
  WorkflowTemplates
} from '@/types/workflowTemplateTypes'
import { normalizeI18nKey } from '@/utils/formatUtil'

export const useWorkflowTemplatesStore = defineStore(
  'workflowTemplates',
  () => {
    const { t } = useI18n()
    const customTemplates = shallowRef<{ [moduleName: string]: string[] }>({})
    const coreTemplates = shallowRef<WorkflowTemplates[]>([])
    const isLoaded = ref(false)

    const groupedTemplates = computed<TemplateGroup[]>(() => {
      const allTemplates = [
        ...coreTemplates.value.map((template) => ({
          ...template,
          title: t(
            `templateWorkflows.category.${normalizeI18nKey(template.title)}`,
            {
              defaultValue: template.title
            }
          )
        })),
        ...Object.entries(customTemplates.value).map(
          ([moduleName, templates]) => ({
            moduleName,
            title: moduleName,
            templates: templates.map((name) => ({
              name,
              mediaType: 'image',
              mediaSubtype: 'jpg',
              description: name
            }))
          })
        )
      ]

      return Object.entries(
        groupBy(allTemplates, (template) =>
          template.moduleName === 'default'
            ? t('templateWorkflows.category.ComfyUI Examples', {
                defaultValue: 'ComfyUI Examples'
              })
            : t('templateWorkflows.category.Custom Nodes', {
                defaultValue: 'Custom Nodes'
              })
        )
      ).map(([label, modules]) => ({ label, modules }))
    })

    async function loadWorkflowTemplates() {
      try {
        if (!isLoaded.value) {
          customTemplates.value = await api.getWorkflowTemplates()
          coreTemplates.value = await api.getCoreWorkflowTemplates()
          isLoaded.value = true
        }
      } catch (error) {
        console.error('Error fetching workflow templates:', error)
      }
    }

    return {
      groupedTemplates,
      isLoaded,
      loadWorkflowTemplates
    }
  }
)
