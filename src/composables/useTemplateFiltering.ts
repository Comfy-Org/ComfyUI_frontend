import { type Ref, computed, ref } from 'vue'

import type { TemplateInfo } from '@/types/workflowTemplateTypes'

export interface TemplateFilterOptions {
  searchQuery?: string
}

export function useTemplateFiltering(
  templates: Ref<TemplateInfo[]> | TemplateInfo[]
) {
  const searchQuery = ref('')

  const templatesArray = computed(() => {
    const templateData = 'value' in templates ? templates.value : templates
    return Array.isArray(templateData) ? templateData : []
  })

  const filteredTemplates = computed(() => {
    const templateData = templatesArray.value
    if (templateData.length === 0) {
      return []
    }

    if (!searchQuery.value.trim()) {
      return templateData
    }

    const query = searchQuery.value.toLowerCase().trim()
    return templateData.filter((template) => {
      const searchableText = [
        template.name,
        template.description,
        template.sourceModule
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(query)
    })
  })

  const resetFilters = () => {
    searchQuery.value = ''
  }

  const filteredCount = computed(() => filteredTemplates.value.length)

  return {
    searchQuery,
    filteredTemplates,
    filteredCount,
    resetFilters
  }
}
