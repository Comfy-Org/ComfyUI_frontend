import { groupBy } from 'lodash'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { st } from '@/i18n'
import { api } from '@/scripts/api'
import type {
  TemplateGroup,
  TemplateInfo,
  WorkflowTemplates
} from '@/types/workflowTemplateTypes'
import { normalizeI18nKey } from '@/utils/formatUtil'

const SHOULD_SORT_CATEGORIES = new Set([
  // API Node templates should be strictly sorted by name to avoid any
  // favoritism or bias towards a particular API. Other categories can
  // have their ordering specified in index.json freely.
  'Image API',
  'Video API'
])

export const useWorkflowTemplatesStore = defineStore(
  'workflowTemplates',
  () => {
    const customTemplates = shallowRef<{ [moduleName: string]: string[] }>({})
    const coreTemplates = shallowRef<WorkflowTemplates[]>([])
    const isLoaded = ref(false)

    /**
     * Sort a list of templates in alphabetical order by name.
     */
    const sortTemplateList = (templates: TemplateInfo[]) =>
      templates.sort((a, b) => a.name.localeCompare(b.name))

    /**
     * Sort any template categories (grouped templates) that should be sorted.
     * Leave other categories' templates in their original order specified in index.json
     */
    const sortCategoryTemplates = (categories: WorkflowTemplates[]) =>
      categories.map((category) => {
        if (SHOULD_SORT_CATEGORIES.has(category.title)) {
          return {
            ...category,
            templates: sortTemplateList(category.templates)
          }
        }
        return category
      })

    const groupedTemplates = computed<TemplateGroup[]>(() => {
      const allTemplates = [
        ...sortCategoryTemplates(coreTemplates.value).map((template) => ({
          ...template,
          title: st(
            `templateWorkflows.category.${normalizeI18nKey(template.title)}`,
            template.title ?? template.moduleName
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
            ? st(
                'templateWorkflows.category.ComfyUI Examples',
                'ComfyUI Examples'
              )
            : st('templateWorkflows.category.Custom Nodes', 'Custom Nodes')
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
