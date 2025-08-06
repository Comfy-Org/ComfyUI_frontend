import { type Ref, computed, ref } from 'vue'

import type { TemplateInfo } from '@/types/workflowTemplateTypes'

export type SortOption = 'recommended' | 'alphabetical' | 'newest'

export interface TemplateFilterOptions {
  searchQuery?: string
  selectedModels?: string[]
  selectedSubcategory?: string | null
  sortBy?: SortOption
}

export function useTemplateFiltering(
  templates: Ref<TemplateInfo[]> | TemplateInfo[]
) {
  const searchQuery = ref('')
  const selectedModels = ref<string[]>([])
  const selectedSubcategory = ref<string | null>(null)
  const sortBy = ref<SortOption>('recommended')

  const templatesArray = computed(() => {
    const templateData = 'value' in templates ? templates.value : templates
    return Array.isArray(templateData) ? templateData : []
  })

  // Get unique subcategories (tags) from current templates
  const availableSubcategories = computed(() => {
    const subcategorySet = new Set<string>()
    templatesArray.value.forEach((template) => {
      template.tags?.forEach((tag) => subcategorySet.add(tag))
    })
    return Array.from(subcategorySet).sort()
  })

  // Get unique models from all current templates (don't filter by subcategory for model list)
  const availableModels = computed(() => {
    const modelSet = new Set<string>()

    templatesArray.value.forEach((template) => {
      template.models?.forEach((model) => modelSet.add(model))
    })
    return Array.from(modelSet).sort()
  })

  const filteredTemplates = computed(() => {
    let templateData = templatesArray.value
    if (templateData.length === 0) {
      return []
    }

    // Filter by search query
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim()
      templateData = templateData.filter((template) => {
        const searchableText = [
          template.name,
          template.title,
          template.description,
          template.sourceModule,
          ...(template.tags || [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return searchableText.includes(query)
      })
    }

    // Filter by subcategory
    if (selectedSubcategory.value) {
      templateData = templateData.filter((template) =>
        template.tags?.includes(selectedSubcategory.value!)
      )
    }

    // Filter by selected models
    if (selectedModels.value.length > 0) {
      templateData = templateData.filter((template) =>
        template.models?.some((model) => selectedModels.value.includes(model))
      )
    }

    // Sort templates
    const sortedData = [...templateData]
    switch (sortBy.value) {
      case 'alphabetical':
        sortedData.sort((a, b) =>
          (a.title || a.name).localeCompare(b.title || b.name)
        )
        break
      case 'newest':
        sortedData.sort((a, b) => {
          const dateA = new Date(a.date || '1970-01-01')
          const dateB = new Date(b.date || '1970-01-01')
          return dateB.getTime() - dateA.getTime()
        })
        break
      case 'recommended':
      default:
        // Keep original order for recommended (assumes templates are already in recommended order)
        break
    }

    return sortedData
  })

  const resetFilters = () => {
    searchQuery.value = ''
    selectedModels.value = []
    selectedSubcategory.value = null
    sortBy.value = 'recommended'
  }

  const resetModelFilters = () => {
    selectedModels.value = []
  }

  const filteredCount = computed(() => filteredTemplates.value.length)

  return {
    searchQuery,
    selectedModels,
    selectedSubcategory,
    sortBy,
    availableSubcategories,
    availableModels,
    filteredTemplates,
    filteredCount,
    resetFilters,
    resetModelFilters
  }
}
